# auth.py — Minimal custom auth for langgraph dev to enable user identity isolation
#
# Reads X-User-Id header and sets it as the request user identity, so
# memscope.py's namespace function can isolate memory by user.
from langgraph_sdk import Auth

auth = Auth()


@auth.authenticate
async def authenticate(headers: dict) -> dict:
    """Trust X-User-Id header (development only — no real auth)."""
    user_id = (
        headers.get(b"x-user-id")
        or headers.get("x-user-id")
        or b"anonymous"
    )
    if isinstance(user_id, bytes):
        user_id = user_id.decode("utf-8")
    return {"identity": user_id, "permissions": []}
