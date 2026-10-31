class UpstreamUnavailable(Exception):
    """Upstream weather/geocoding service is unavailable."""


class UpstreamRateLimited(Exception):
    """Upstream rate limit hit."""

    def __init__(self, message: str = "rate limited", retry_after: int = 60):
        super().__init__(message)
        self.retry_after = retry_after
