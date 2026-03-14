from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Domains(Base):
    __tablename__ = "domains"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    domain_key = Column(String, nullable=False)
    domain_name = Column(String, nullable=True)
    state_json = Column(String, nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=True)