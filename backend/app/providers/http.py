import httpx

from app.errors import UpstreamRateLimited, UpstreamUnavailable


async def get_json(client: httpx.AsyncClient, url: str, params: dict | None, timeout: float) -> dict:
    """GET a JSON object, retrying once on transport errors and mapping failures to upstream errors."""
    resp = None
    for attempt in range(2):
        try:
            resp = await client.get(url, params=params, timeout=timeout)
            break
        except httpx.TransportError as e:  # includes timeouts
            if attempt == 1:
                raise UpstreamUnavailable(f"network error: {e!r}") from e
    assert resp is not None
    if resp.status_code == 429:
        try:
            retry_after = int(resp.headers.get("Retry-After", 60))
        except ValueError:
            retry_after = 60
        raise UpstreamRateLimited(retry_after=retry_after)
    if resp.status_code >= 400:
        raise UpstreamUnavailable(f"upstream status {resp.status_code}")
    try:
        data = resp.json()
    except ValueError as e:
        raise UpstreamUnavailable("invalid JSON from upstream") from e
    if not isinstance(data, dict):
        raise UpstreamUnavailable("unexpected JSON shape from upstream")
    return data
