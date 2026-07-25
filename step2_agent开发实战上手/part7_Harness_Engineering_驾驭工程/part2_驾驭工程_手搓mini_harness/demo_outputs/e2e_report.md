# E2E Demo 报告：Baseline vs Full Harness

> 模型：`deepseek-chat`
> 测试时间：2026-04-24 21:17:25
> 测试任务：分析 `main.py` 中的重复代码并给出重构建议

<p align="center"><font face="黑体" size=4>Baseline vs Full Harness 端到端对比</font></p>

| 维度 | Baseline | Full Harness (10 机制) | 差异 |
|---|---|---|---|
| 步骤数 | 1 | 9 | +8 |
| 耗时 (s) | 9.35 | 43.68 | +34.33 |
| 总 tokens | 983 | 29139 | +28156 |
| 拦截次数 (Permission) | 0 | 0 | — |
| 错误数 | 0 | 0 | — |


## Budget 报告（Full Harness）

- 累计成本：$0.1245 USD
- 预算上限：$0.50 USD
- 是否超限：否
- 迭代数：9
- 输入 tokens：26052
- 输出 tokens：3087


## Baseline 输出（完整）

```
## 代码重复问题分析

我发现了以下 **2 处明显的重复模式**：

### 重复模式 1：折扣计算逻辑重复

在 `calculate_discount` 函数中，三个分支的折扣计算逻辑完全相同，只是折扣率不同：

```python
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
```

同样的问题也出现在 `process_order` 函数中。

### 重复模式 2：折扣率映射重复

两个函数中都硬编码了相同的客户类型到折扣率的映射关系：
- regular → 0.05
- vip → 0.15  
- premium → 0.25

## 重构建议

### 方案一：使用字典映射

```python
DISCOUNT_RATES = {
    "regular": 0.05,
    "vip": 0.15,
    "premium": 0.25,
}

def calculate_discount(price, customer_type):
    """Calculate discount based on customer type."""
    rate = DISCOUNT_RATES.get(customer_type, 0)
    return price * (1 - rate)

def process_order(items, customer_type):
    """Process order with discount."""
    total = sum(item["price"] for item in items)
    rate = DISCOUNT_RATES.get(customer_type, 0)
    return total * (1 - rate)
```

### 方案二：提取通用折扣函数（更灵活）

```python
DISCOUNT_RATES = {
    "regular": 0.05,
    "vip": 0.15,
    "premium": 0.25,
}

def apply_discount(amount, customer_type):
    """Apply discount rate to the given amount."""
    rate = DISCOUNT_RATES.get(customer_type, 0)
    return amount * (1 - rate)

def calculate_discount(price, customer_type):
    """Calculate discount based on customer type."""
    return apply_discount(price, customer_type)

def process_order(items, customer_type):
    """Process order with discount."""
    total = sum(item["price"] for item in items)
    return apply_discount(total, customer_type)
```

### 方案三：使用枚举类（类型安全）

```python
from enum import Enum

class CustomerType(Enum):
    REGULAR = 0.05
    VIP = 0.15
    PREMIUM = 0.25

def apply_discount(amount, customer_type: CustomerType):
    """Apply discount rate to the given amount."""
    return amount * (1 - customer_type.value)

def process_order(items, customer_type: CustomerType):
    """Process order with discount."""
    total = sum(item["price"] for item in items)
    return apply_discount(total, customer_type)
```

**推荐方案二**，它平衡了简洁性、可维护性和扩展性，同时清晰地分离了折扣计算逻辑。
```

## Full Harness 输出（完整）

```
---

## 完整重构方案

### (a) 至少 2 处重复模式的具体位置

**重复模式 1：if-elif 折扣计算逻辑在多个函数中重复**

在 `calculate_discount` 函数（第 7-15 行）和 `process_order` 函数（第 27-38 行）中，存在完全相同的 if-elif 分支结构：

```
if customer_type == "regular":   discount = amount * 0.05;  final = amount - discount
elif customer_type == "vip":     discount = amount * 0.15;  final = amount - discount
elif customer_type == "premium": discount = amount * 0.25;  final = amount - discount
else:                            final = amount
```

这段逻辑在两个函数中逐字重复，只是变量名从 `price`/`final_price` 变成了 `total`/`final_total`。一旦需要修改折扣率、增加新的客户类型或调整折扣策略，就必须在两个地方同步修改，极易遗漏。

**重复模式 2：折扣率作为硬编码魔数散落在各处**

折扣率 `0.05`（regular）、`0.15`（vip）、`0.25`（premium）在两个函数中分别硬编码出现了 3 次，总共 6 次。这些魔法数字没有命名，没有集中管理，阅读代码时无法直观理解其含义，修改时容易只改了某处而遗漏另一处。

---

### (b) 重构代码示例（已验证通过）

```python
"""重构版本：消除代码重复"""

# 集中管理折扣率配置
DISCOUNT_RATES = {
    "regular": 0.05,
    "vip": 0.15,
    "premium": 0.25,
}

def apply_discount(amount, customer_type):
    """根据客户类型对金额应用折扣，返回折扣后的金额。"""
    rate = DISCOUNT_RATES.get(customer_type, 0.0)
    return amount * (1 - rate)


def calculate_discount(price, customer_type):
    """Calculate discount based on customer type."""
    return apply_discount(price, customer_type)


def process_order(items, customer_type):
    """Process order with discount."""
    total = sum(item["price"] for item in items)
    return apply_discount(total, customer_type)
```

---

### (c) 为什么这样重构更好

1. **消除重复，降低维护成本**：原本 2 处 if-elif 分支被合并为 `apply_discount` 一个公共函数，折扣计算逻辑只有一份。新增客户类型（如 `"gold"`）只需在 `DISCOUNT_RATES` 字典加一行，`calculate_discount` 和 `process_order` 都不需要改动。

2. **配置与逻辑分离**：折扣率从散落的魔数提升为顶层字典常量 `DISCOUNT_RATES`，一目了然。修改折扣率时只需修改字典值，不会遗漏。

3. **遵循 DRY（Don't Repeat Yourself）原则**：每个业务规则（什么客户类型对应什么折扣率）在系统中只出现一次，消除了"一处改、多处忘改"的隐患。

4. **可读性提升**：`apply_discount(amount, customer_type)` 的语义清晰直白；`sum(item["price"] for item in items)` 比手写循环更 Pythonic；`DISCOUNT_RATES.get(customer_type, 0.0)` 优雅处理了未知客户类型（返回 0 折扣），替代了冗长的 else 分支。

5. **可测试性增强**：核心逻辑集中在 `apply_discount` 一个函数中，只需针对它写单元测试即可覆盖所有折扣场景，无需为每个上层函数重复测试。

---

### (d) run_python 验证结果摘要

- **passed**: `true`
- **exit_code**: `0`
- **stderr**: 空（无任何错误输出）
- **关键 stdout**：
  - 断言 1（`calculate_discount` 等价性）：覆盖了 5 种价格 × 5 种客户类型 = 25 个测试组合，全部通过 ✅
  - 断言 2（`process_order` 等价性）：覆盖了 4 组 items × 5 种客户类型 = 20 个测试组合，全部通过 ✅
  - 断言 3（边界情况）：空列表返回 0、价格为 0 返回 0，全部通过 ✅
  - 最终结论：**"所有断言通过！重构验证成功！"**

重构后的代码与原函数在全部 47 个测试用例上输出完全一致（误差 < 1e-9），证明了重构的正确性。
```

## 关键观察

1. Full Harness 通过 TODO 工具把任务拆成清单，每步单独推理。
2. Progress Tracker 实时把每步写到 `demo_outputs/progress.md`，跨 session 续传的基础设施。
3. Permission Gate 对 `run_bash` 的危险命令进行拦截，demo 中 `blocked_tools=0`。
4. Token Budget 实时累计成本并在超限时优雅终止（本次 $0.1245 < 上限 $0.50，未触发）。

## 文件清单

- `demo_outputs/progress.md` — Progress Tracker 真实落盘记录
- `demo_outputs/e2e_result.json` — 完整指标（JSON 可编程读）
- `demo_outputs/e2e_report.md` — 本报告（课件可直接引用）
