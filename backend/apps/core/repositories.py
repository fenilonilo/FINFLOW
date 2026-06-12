from apps.core.models import Category, PaymentMethod


class CategoryRepository:
    @staticmethod
    def get_by_id(category_id: int, user_id: int) -> Category:
        from apps.common.exceptions import NotFoundError

        try:
            return Category.objects.get(id=category_id, user_id=user_id)
        except Category.DoesNotExist:
            raise NotFoundError(f"Category {category_id} not found")

    @staticmethod
    def list_by_user(
        user_id: int, include_archived: bool = False
    ) -> list[Category]:
        qs = Category.objects.filter(user_id=user_id)
        if not include_archived:
            qs = qs.filter(is_archived=False)
        return list(qs)

    @staticmethod
    def transaction_count(category_id: int) -> int:
        from apps.transactions.models import Transaction

        return Transaction.objects.filter(category_id=category_id).count()


class PaymentMethodRepository:
    @staticmethod
    def get_by_id(pm_id: int, user_id: int) -> PaymentMethod:
        from apps.common.exceptions import NotFoundError

        try:
            return PaymentMethod.objects.get(id=pm_id, user_id=user_id)
        except PaymentMethod.DoesNotExist:
            raise NotFoundError(f"PaymentMethod {pm_id} not found")

    @staticmethod
    def get_with_card(pm_id: int, user_id: int) -> PaymentMethod:
        from apps.common.exceptions import NotFoundError

        try:
            return PaymentMethod.objects.select_related("card").get(
                id=pm_id, user_id=user_id
            )
        except PaymentMethod.DoesNotExist:
            raise NotFoundError(f"PaymentMethod {pm_id} not found")

    @staticmethod
    def list_by_user(
        user_id: int, include_archived: bool = False
    ) -> list[PaymentMethod]:
        qs = PaymentMethod.objects.filter(user_id=user_id)
        if not include_archived:
            qs = qs.filter(is_archived=False)
        return list(qs)
