from app.core.config import ApplicationSettings


def test_default_settings():
    settings = ApplicationSettings(_env_file=None)

    assert settings.app_name == "RCA Project"
    assert settings.port == 8080
