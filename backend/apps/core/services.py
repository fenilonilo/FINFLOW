from decimal import Decimal

from apps.common.exceptions import DomainError, ValidationDomainError
from apps.core.models import Category, PaymentMethod
from apps.core.repositories import CategoryRepository, PaymentMethodRepository


class CategoryService:
    def create(
        self,
        user_id: int,
        name: str,
        icon: str = "circle",
        color: str = "#94a3b8",
        parent_id: int | None = None,
        monthly_budget: Decimal | None = None,
    ) -> Category:
        if parent_id:
            parent = CategoryRepository.get_by_id(parent_id, user_id)
            if parent.parent_id is not None:
                raise ValidationDomainError(
                    {"parent": ["Subcategorias só permitidas em 1 nível."]}
                )
        return Category.objects.create(
            user_id=user_id,
            name=name,
            icon=icon,
            color=color,
            parent_id=parent_id,
            monthly_budget=monthly_budget,
        )

    def archive(self, category_id: int, user_id: int) -> Category:
        cat = CategoryRepository.get_by_id(category_id, user_id)
        cat.is_archived = True
        cat.save()
        return cat

    def delete(self, category_id: int, user_id: int) -> None:
        cat = CategoryRepository.get_by_id(category_id, user_id)
        if cat.is_default:
            raise DomainError("Categorias padrão não podem ser deletadas.")
        if CategoryRepository.transaction_count(category_id) > 0:
            raise DomainError("Categoria possui transações. Use arquivar.")
        cat.delete()


class PaymentMethodService:
    def create(
        self,
        user_id: int,
        name: str,
        icon: str = "credit-card",
        color: str = "#94a3b8",
    ) -> PaymentMethod:
        return PaymentMethod.objects.create(
            user_id=user_id, name=name, icon=icon, color=color
        )

    def archive(self, pm_id: int, user_id: int) -> PaymentMethod:
        pm = PaymentMethodRepository.get_by_id(pm_id, user_id)
        pm.is_archived = True
        pm.save()
        return pm
