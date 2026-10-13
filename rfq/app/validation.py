import re

REQUIRED = ("name", "company", "email", "country", "need")
OPTIONAL = ("valve_type", "size", "quantity", "media", "pressure", "temperature", "materials", "connection", "application",
            "delivery_date", "destination", "phone")
MAXLEN = {"need": 5000, "application": 2000, "materials": 500, "media": 300}
DEFAULT_MAX = 200
MULTILINE = {"need", "application", "materials", "media"}
VALVES = {"ball", "butterfly", "gate", "check", "unsure"}
LANGS = {"en", "de", "es", "fr"}
EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean(form):
    """Returns (data, lang, errors). Messages are English; the UI maps field->localised text."""
    errors, data = {}, {}
    for k in REQUIRED + OPTIONAL:
        v = form.get(k)
        v = CTRL.sub("", v).strip() if isinstance(v, str) else ""
        if k not in MULTILINE:
            v = " ".join(v.split())
        if v and len(v) > MAXLEN.get(k, DEFAULT_MAX):
            errors[k] = "too long"
        data[k] = v
    for k in REQUIRED:
        if not data[k]:
            errors.setdefault(k, "required")
    if data["email"] and "email" not in errors and (not EMAIL.match(data["email"]) or "\n" in data["email"]):
        errors["email"] = "invalid email address"
    if data["valve_type"] and data["valve_type"] not in VALVES:
        errors["valve_type"] = "must be one of " + ", ".join(sorted(VALVES))
    if data["phone"] and not re.fullmatch(r"[0-9 +().\-/]{5,30}", data["phone"]):
        errors["phone"] = "invalid phone number"
    lang = (form.get("lang") or "en").strip().lower()
    if lang not in LANGS:
        errors["lang"] = "must be one of en, de, es, fr"
        lang = "en"
    return {k: v for k, v in data.items() if v}, lang, errors
