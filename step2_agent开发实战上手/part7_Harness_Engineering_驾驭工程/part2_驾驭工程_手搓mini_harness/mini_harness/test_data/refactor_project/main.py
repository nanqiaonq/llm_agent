"""Sample code with duplication for testing."""

def calculate_discount(price, customer_type):
    """Calculate discount based on customer type."""
    if customer_type == "regular":
        discount = price * 0.05
        final_price = price - discount
        return final_price
    elif customer_type == "vip":
        discount = price * 0.15
        final_price = price - discount
        return final_price
    elif customer_type == "premium":
        discount = price * 0.25
        final_price = price - discount
        return final_price
    else:
        return price


def process_order(items, customer_type):
    """Process order with discount."""
    total = 0
    for item in items:
        total += item["price"]

    # Apply discount
    if customer_type == "regular":
        discount = total * 0.05
        final_total = total - discount
    elif customer_type == "vip":
        discount = total * 0.15
        final_total = total - discount
    elif customer_type == "premium":
        discount = total * 0.25
        final_total = total - discount
    else:
        final_total = total

    return final_total
