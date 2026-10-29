"""End-to-end checks against a running instance (stdlib only, no browser).

Local:   docker compose up -d && npm run db:seed && npm run build && npm start -- -p 3100
         python3 -I tests/e2e.py
Remote:  E2E_BASE=https://... E2E_DB_ENV=.env.supabase python3 -I tests/e2e.py
         (it mutates data: run `npm run db:seed` afterwards to restore the demo)
"""
import re, subprocess, sys, os, tempfile

BASE = os.environ.get("E2E_BASE", "http://localhost:3100")
PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = tempfile.mkdtemp()

def db(q):
    env_file = os.environ.get("E2E_DB_ENV")  # remote run: query Supabase through a psql container
    if env_file:
        cmd = ["docker", "run", "--rm", "--env-file", env_file, "postgres:17-alpine", "sh", "-c", 'psql "$DATABASE_URL" -At -c "$0"', q]
    else:
        cmd = ["docker", "compose", "exec", "-T", "db", "psql", "-U", "transekur", "-d", "transekur", "-At", "-c", q]
    return subprocess.run(cmd, cwd=PROJ, capture_output=True, text=True).stdout.strip()

def curl(args):
    return subprocess.run(["curl", "-s"] + args, capture_output=True, text=True).stdout

class Client:
    def __init__(self, name):
        self.jar = os.path.join(tmp, name)
    def get(self, path):
        # follow redirects; report the final URL
        out = curl(["-L", "-b", self.jar, "-c", self.jar, "-w", "\n@@URL=%{url_effective}", BASE + path])
        body, _, url = out.rpartition("\n@@URL=")
        return body, url.replace(BASE, "")
    def forms(self, html):
        return re.findall(r"<form[^>]*>.*?</form>", html, re.S)
    def post(self, path, form_html, fields, hidden=True):
        action = re.search(r'name="(\$ACTION_ID_[^"]+)"', form_html).group(1)
        args = ["-b", self.jar, "-c", self.jar, "-o", "/dev/null", "-w", "%{http_code} %{redirect_url}", "-F", f"{action}="]
        for k, v in fields.items():
            args += ["-F", f"{k}={v}"]
        out = curl(args + [BASE + path]).strip()
        code, _, loc = out.partition(" ")
        return code, loc.replace(BASE, "")

failed = False
def check(name, cond, extra=""):
    global failed
    print(("PASS " if cond else "FAIL ") + name + (("  -> " + extra) if extra else ""))
    failed = failed or not cond

def login(c, email, password="demo1234"):
    html, _ = c.get("/login")
    f = [x for x in c.forms(html) if 'name="email"' in x][0]
    return c.post("/login", f, {"email": email, "password": password})

# --- anonymous
anon = Client("anon")
_, url = anon.get("/driver")
check("anon /driver -> /login", url == "/login", url)
_, url = anon.get("/dispatch")
check("anon /dispatch -> /login", url == "/login", url)

# --- wrong password / unknown email
bad = Client("bad")
code, loc = login(bad, "carlos@transekur.test", "nope")
check("wrong password -> /login?error=1", loc == "/login?error=1", f"{code} {loc}")
code, loc = login(bad, "nobody@transekur.test")
check("unknown email -> /login?error=1", loc == "/login?error=1", f"{code} {loc}")
_, url = bad.get("/driver")
check("still anonymous after failed login", url == "/login", url)

# --- driver
carlos = Client("carlos")
code, loc = login(carlos, "carlos@transekur.test")
check("carlos login -> /driver", loc == "/driver", f"{code} {loc}")
page, url = carlos.get("/driver")
check("carlos sees his 2 services", "Laura Gómez" in page and "John Smith" in page)
check("carlos does NOT see María's client", "Ana Martínez" not in page)
_, url = carlos.get("/dispatch")
check("driver blocked from /dispatch", url != "/dispatch", url)

# forge: carlos submits the button with María's service id
maria_svc = db("select id from services where client_name like 'Ana%'")
forms = [f for f in carlos.forms(page) if 'name="serviceId"' in f]
carlos.post("/driver", forms[0], {"serviceId": maria_svc})
check("forged serviceId (other driver's) creates no notice", db(f"select count(*) from notices where service_id={maria_svc}") == "0")

# forge: carlos tries to create a service (dispatch-only action) using the action id from a dispatch page
disp = Client("dispatch")
login(disp, "dispatch@transekur.test")
dpage, url = disp.get("/dispatch")
check("dispatch login -> /dispatch", url == "/dispatch", url)
create_form = [f for f in disp.forms(dpage) if 'name="client"' in f][0]
before = db("select count(*) from services")
code, loc = carlos.post("/driver", create_form, {"client": "Hacker", "phone": "+1 809 555 0000", "when": "2030-01-01T10:00", "pickup": "x", "driver": "2"})
check("driver cannot call createService", db("select count(*) from services") == before and db("select count(*) from services where client_name='Hacker'") == "0", f"{code} {loc}")

# real tap, twice
laura = db("select id from services where client_name like 'Laura%'")
carlos.post("/driver", forms[0], {"serviceId": laura})
carlos.post("/driver", forms[0], {"serviceId": laura})
check("exactly one notice after double tap", db(f"select count(*) from notices where service_id={laura}") == "1")
msg = db(f"select message from notices where service_id={laura}")
check("message has driver + vehicle + client", all(s in msg for s in ["Carlos Pérez", "Toyota Alphard", "Laura Gómez"]), msg)
page, _ = carlos.get("/driver")
check("driver page shows 'Aviso enviado a las'", "Aviso enviado a las" in page)

# --- dispatch sees it
dpage, _ = disp.get("/dispatch")
check("dispatch shows sent time", "Aviso enviado a las" in dpage)
check("dispatch shows simulated SMS with driver/vehicle", "SMS simulado" in dpage and "Carlos Pérez" in dpage and "Toyota Alphard" in dpage)
pending = len(re.findall(r">Aviso pendiente</p>", dpage))  # raw text also appears in the RSC payload
check("two others still pending", pending == 2, str(pending))
check("wa.me link has digits only", "https://wa.me/18095550101?text=" in dpage)

# --- dispatch creates service
today = db("select to_char(now() at time zone 'America/Santo_Domingo','YYYY-MM-DD')")
create_form = [f for f in disp.forms(dpage) if 'name="client"' in f][0]
code, loc = disp.post("/dispatch", create_form, {"client": "Pedro Demo", "phone": "+1 809 555 0199", "when": f"{today}T23:30", "pickup": "Hotel Demo", "driver": "3"})
check("create service ok", loc == "/dispatch?created=1", f"{code} {loc}")
check("stored at 23:30 Santo Domingo = 03:30 UTC next day", db("select to_char(pickup_at at time zone 'UTC','HH24:MI') from services where client_name='Pedro Demo'") == "03:30")

# invalid inputs
for label, fields in {
    "bad phone": {"client": "X", "phone": "abc", "when": f"{today}T10:00", "pickup": "Y", "driver": "3"},
    "bad date": {"client": "X", "phone": "+1 809 555 0100", "when": "mañana", "pickup": "Y", "driver": "3"},
    "driver id of a dispatcher": {"client": "X", "phone": "+1 809 555 0100", "when": f"{today}T10:00", "pickup": "Y", "driver": "1"},
    "missing driver": {"client": "X", "phone": "+1 809 555 0100", "when": f"{today}T10:00", "pickup": "Y", "driver": ""},
}.items():
    code, loc = disp.post("/dispatch", create_form, fields)
    check(f"rejects {label}", loc == "/dispatch?error=invalid" and db("select count(*) from services where client_name='X'") == "0", f"{code} {loc}")

# --- María sees Ana + Pedro, not Carlos'
maria = Client("maria")
login(maria, "maria@transekur.test")
mp, _ = maria.get("/driver")
check("maria sees Ana and Pedro only", "Ana Martínez" in mp and "Pedro Demo" in mp and "Laura" not in mp and "John Smith" not in mp)

# --- demo reset button: dispatch only, idempotent, leaves non-demo rows alone
dpage, _ = disp.get("/dispatch")
reset_form = [f for f in disp.forms(dpage) if "Cargar servicios" in f][0]
notices_before = db("select count(*) from notices")
carlos2 = Client("carlos2")
login(carlos2, "carlos@transekur.test")
code, loc = carlos2.post("/driver", reset_form, {})
check("driver cannot call resetDemoServices", db("select count(*) from notices") == notices_before and loc == "/", f"{code} {loc}")
for i in (1, 2):  # twice: must not duplicate
    code, loc = disp.post("/dispatch", reset_form, {})
    check(f"dispatch reset #{i} ok", loc == "/dispatch?reset=1", f"{code} {loc}")
check("exactly 3 demo services after two resets", db("select count(*) from services where client_name like '% (demo)'") == "3")
check("demo notices cleared by the reset", db("select count(*) from notices") == "0")
check("non-demo service (Pedro) untouched", db("select count(*) from services where client_name='Pedro Demo'") == "1")
check("demo services are for today", db("select count(*) from services where client_name like '% (demo)' and (pickup_at at time zone 'America/Santo_Domingo')::date = (now() at time zone 'America/Santo_Domingo')::date") == "3")
mp, _ = maria.get("/driver")
check("maria sees Ana again after reset", "Ana Martínez" in mp)

# --- logout kills the session
lf = [f for f in carlos.forms(page) if "Salir" in f][0]
carlos.post("/driver", lf, {})
_, url = carlos.get("/driver")
check("logout -> back to /login", url == "/login", url)

print("FAILED" if failed else "ALL PASSED")
sys.exit(1 if failed else 0)
