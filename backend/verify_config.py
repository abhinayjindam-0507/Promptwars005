"""Verification script for MedLens secure OpenAI configuration.

Validates that Settings correctly loads configuration from backend/.env
via pydantic-settings, caches the instance, and keeps the API key protected
without exposing or printing the secret.
"""

import sys

from app.core.config import Settings, get_settings, settings


def verify_configuration() -> bool:
    print("=" * 60)
    print("MedLens Configuration Verification")
    print("=" * 60)

    # 1. Type validation
    assert isinstance(settings, Settings), "settings must be an instance of Settings"
    print("  ✓ Settings loaded successfully via Pydantic.")

    # 2. Caching verification
    cached_instance = get_settings()
    assert cached_instance is settings, "get_settings() must return the cached singleton"
    print("  ✓ Settings instance is properly cached (singleton pattern).")

    # 3. Model setting verification
    assert settings.OPENAI_MODEL, "OPENAI_MODEL must not be empty"
    print(f"  ✓ OpenAI model setting verified: '{settings.OPENAI_MODEL}'.")

    # 4. Key presence verification (without exposing value)
    assert settings.is_openai_configured, "OPENAI_API_KEY must be configured in backend/.env"
    assert settings.OPENAI_API_KEY.startswith("sk-"), "Key must begin with standard OpenAI prefix"
    print("  ✓ OPENAI_API_KEY is present and formatted correctly.")

    # 5. Security & redaction check: Ensure __str__ and __repr__ do not leak key
    str_repr = str(settings)
    assert settings.OPENAI_API_KEY not in str_repr, "Raw key must never appear in string representation"
    assert "sk-" not in str_repr, "Key prefix must not leak in string representation"
    assert "configured" in str_repr, "Representation should indicate configured status"
    print("  ✓ String representation strictly redacts secret values.")

    print("\n" + "=" * 60)
    print("OpenAI configuration verified securely (0 keys exposed).")
    print("=" * 60)
    return True


if __name__ == "__main__":
    try:
        success = verify_configuration()
        if not success:
            sys.exit(1)
    except AssertionError as err:
        print(f"\n[ERROR] Verification failed: {err}", file=sys.stderr)
        sys.exit(1)
