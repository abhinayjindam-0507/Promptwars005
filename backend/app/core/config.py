from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base backend directory: .../backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded securely from environment variables and backend/.env."""

    OPENAI_API_KEY: Optional[str] = Field(
        default=None,
        description="OpenAI API Key for clinical intelligence tasks.",
    )
    OPENAI_MODEL: str = Field(
        default="gpt-4o",
        description="Default OpenAI model identifier for structured clinical extraction.",
    )

    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def is_openai_configured(self) -> bool:
        """Indicate whether a non-empty OpenAI API key is available."""
        return bool(self.OPENAI_API_KEY and self.OPENAI_API_KEY.strip())

    @property
    def openai_api_key(self) -> Optional[str]:
        """Convenience property for accessing the configured key."""
        return self.OPENAI_API_KEY

    @property
    def openai_model(self) -> str:
        """Convenience property for accessing the model name."""
        return self.OPENAI_MODEL

    def __repr__(self) -> str:
        key_status = "configured" if self.is_openai_configured else "not configured"
        return f"<Settings model='{self.OPENAI_MODEL}' openai_key={key_status}>"

    def __str__(self) -> str:
        return self.__repr__()


@lru_cache
def get_settings() -> Settings:
    """Provide a cached singleton settings instance across the application lifecycle."""
    return Settings()


settings: Settings = get_settings()
