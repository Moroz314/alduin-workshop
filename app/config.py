from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    secret_key: str = "change-me-in-production"
    allowed_origins: str = ""
    site_base_url: str = "http://139.100.224.102"

    # YooKassa acquiring
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""
    yookassa_return_url: str = "http://139.100.224.102/checkout"

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "alduinworkshop"
    postgres_user: str = "postgres"
    postgres_password: str = ""

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # SMTP Settings
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    admin_email: str = ""

    # CDEK Logistics
    cdek_account: str = ""
    cdek_secure_password: str = ""
    cdek_is_test: bool = True
    cdek_sender_city_code: int = 137  # Санкт-Петербург
    cdek_sender_name: str = ""
    cdek_sender_phone: str = ""
    cdek_delivery_type: str = "pvz"   # 'pvz' или 'courier'
    cdek_sender_pvz_code: str = ""
    cdek_sender_address: str = ""
    cdek_tariff_codes: str = "136, 368, 234"
    cdek_default_weight: int = 1000   # граммы
    cdek_default_length: int = 25     # см
    cdek_default_width: int = 20      # см
    cdek_default_height: int = 10     # см
    cdek_default_tariff_code: int = 136  # Посылка склад-склад/ПВЗ

    @property
    def database_url(self) -> str:
        """Async DSN для asyncpg."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


@lru_cache
def get_settings() -> Settings:
    """Синглтон настроек — читается один раз и кэшируется."""
    return Settings()
