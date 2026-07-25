# memscope.py — Memory-scoped deepagent for chapter 6.7 namespace isolation demo
#
# Configures Memory namespace using LangGraph runtime user identity, so different
# user contexts get isolated memory spaces. Registered in langgraph.json as
# graph_id="memscope" and started via `langgraph dev`.
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
MODEL = f"deepseek:{DEEPSEEK_MODEL}"


def _user_namespace(rt):
    """User-scoped namespace.

    Falls back to ('default',) when runtime context is missing
    (graph-external execution path, e.g. unit tests / utility hooks).
    """
    if rt is None or not hasattr(rt, "server_info") or rt.server_info is None:
        return ("default",)
    # In LangGraph dev mode (noop auth) user identity defaults to "" or "langsmith-user-id"
    # set by SDK headers. We use a (assistant_id, identity) tuple so each user gets
    # an isolated memory namespace.
    assistant_id = getattr(rt.server_info, "assistant_id", "default-assistant")
    user_obj = getattr(rt.server_info, "user", None)
    identity = getattr(user_obj, "identity", "anonymous") if user_obj else "anonymous"
    return (assistant_id, identity)


# Backend: route /memories/ to a user-scoped StoreBackend, default StateBackend for other paths
graph = create_deep_agent(
    model=MODEL,
    system_prompt=(
        "You are a memory-scoped assistant. When user asks you to remember something, "
        "use write_file to save it under /memories/AGENTS.md. When user asks what you "
        "remember, use read_file to load /memories/AGENTS.md and recall the content."
    ),
    backend=CompositeBackend(
        default=StateBackend(),
        routes={
            "/memories/": StoreBackend(namespace=_user_namespace),
        },
    ),
)
