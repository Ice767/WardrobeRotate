# WardrobeRotate

Подписка на капсульный гардероб: клиент платит фиксированную сумму в месяц и
меняет часть вещей из своей капсулы на новые со склада — вместо покупки или
аренды вещей по одной.

Архитектура и стек скопированы с `highland-pet-care-service` (Express 5 + TS
backend, React 19 + MUI + Redux Toolkit frontend), но backend хранит данные
в памяти (mock-сервисы) без AWS Lambda — см. `README` секцию "Simplifications"
ниже.

## Быстрый старт

```bash
cd backend
cp .env.example .env
npm install
npm run dev        # http://localhost:3100
```

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173, проксирует /api на backend
```

Сервер стартует с демо-данными: аккаунт администратора
`admin@wardrobe-rotate.dev` / `AdminPass123!` и небольшой каталог вещей.
Данные живут только в памяти процесса и сбрасываются при перезапуске.

## Тесты

```bash
cd backend && npm test   # node --test, покрывает лимиты подписки и склад
```

## Бизнес-модель

- **BASIC / STANDARD / PREMIUM** — тарифы отличаются лимитом замен в цикл
  (`swapsPerCycle`) и размером капсулы (`PLAN_CAPSULE_SIZE`).
- Первый swap-request клиент делает с пустым `returnItemIds` — так
  формируется стартовая капсула.
- При создании заявки нужный товар резервируется (`available -= 1`) сразу,
  чтобы двое клиентов не забрали последнюю единицу одновременно; при отказе
  (`DECLINED`) резерв возвращается, при завершении (`COMPLETED`) возвращённые
  вещи едут обратно на склад, а капсула клиента обновляется.

## Упрощения относительно highland

- Нет AWS Lambda/gateway слоя — только in-memory mock-сервисы.
- Нет refresh-токена — один access-токен (JWT) в httpOnly cookie, TTL 1 день.
- Нет восстановления пароля по email.
- Нет автогенерируемой OpenAPI/Swagger документации.
