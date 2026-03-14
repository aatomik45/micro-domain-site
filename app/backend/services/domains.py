import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.domains import Domains

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class DomainsService:
    """Service layer for Domains operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Domains]:
        """Create a new domains"""
        try:
            obj = Domains(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created domains with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating domains: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Domains]:
        """Get domains by ID"""
        try:
            query = select(Domains).where(Domains.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching domains {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of domainss"""
        try:
            query = select(Domains)
            count_query = select(func.count(Domains.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Domains, field):
                        query = query.where(getattr(Domains, field) == value)
                        count_query = count_query.where(getattr(Domains, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Domains, field_name):
                        query = query.order_by(getattr(Domains, field_name).desc())
                else:
                    if hasattr(Domains, sort):
                        query = query.order_by(getattr(Domains, sort))
            else:
                query = query.order_by(Domains.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching domains list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Domains]:
        """Update domains"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Domains {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated domains {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating domains {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete domains"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Domains {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted domains {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting domains {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Domains]:
        """Get domains by any field"""
        try:
            if not hasattr(Domains, field_name):
                raise ValueError(f"Field {field_name} does not exist on Domains")
            result = await self.db.execute(
                select(Domains).where(getattr(Domains, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching domains by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Domains]:
        """Get list of domainss filtered by field"""
        try:
            if not hasattr(Domains, field_name):
                raise ValueError(f"Field {field_name} does not exist on Domains")
            result = await self.db.execute(
                select(Domains)
                .where(getattr(Domains, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Domains.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching domainss by {field_name}: {str(e)}")
            raise