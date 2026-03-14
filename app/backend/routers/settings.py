"""Settings admin routes removed during standalone cleanup.

These endpoints previously allowed runtime .env editing behind auth. They
were disabled together with the legacy auth layer to avoid exposing an
insecure unauthenticated admin surface.
"""
