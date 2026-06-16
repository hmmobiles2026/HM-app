# HM Stocks — Customer Guide

---

## Your Login Details

| | |
|---|---|
| **App URL** | _________________________________ |
| **Username** | _________________________________ |
| **Password** | _________________________________ |

Keep this page safe. Do not share your password with anyone you do not trust.


---

## 1. Getting Started

Open the app URL in any browser (Chrome, Firefox, Safari) on your phone or computer.

Enter your **username** and **password** on the login page, then press **Sign In**.

If you forget your password, contact HM Stocks support — details at the end of this guide.

---

## 2. Dashboard

After logging in you land on the **Dashboard**. It shows:

- **Today's revenue and profit**
- **This week's revenue and profit**
- **Total active products in stock**
- **Recent sales chart** (last 30 days)
- **Low stock alert** — items running below their threshold

Any license or trial warnings also appear at the top of the dashboard.

---

## 3. Managing Stock (Products)

Go to **Products** from the menu.

### Adding a product
1. Click **Add Product**
2. Fill in: Brand, Model, Part name, Buying price, Selling price, Stock quantity, Low stock threshold
3. Click **Save**

### Editing a product
Click the pencil icon next to any product to update its details, price, or stock level.

### Low stock threshold
Each product has a threshold. When stock falls to or below that number, the item appears in the low stock alert on the dashboard and in Telegram notifications.

---

## 4. Making a Sale

Go to **Sales** → **Quick Sale** (or **New Sale**).

1. Search for the product
2. Set the quantity and confirm the selling price
3. Click **Complete Sale**

The stock level is automatically reduced and the sale is recorded.

### Viewing past sales
Go to **Sales** → **History** to see all past transactions with date, items, revenue, and profit.

---

## 5. Managing Users (Staff Accounts)

Go to **Settings** → **Users**.

You can create accounts for your staff:

- **Seller** — can make sales and check stock only. Cannot see revenue, profit, or financial summaries.
- **Owner** — full access to everything.

To add a staff member:
1. Click **Add User**
2. Enter their name, username, and a password
3. Set their role to **Seller**
4. Click **Save**

They can log in with those credentials immediately.

---

## 6. Telegram Bot

The Telegram bot sends you automatic alerts and lets you check your business from anywhere on your phone.

### Setting up Telegram

1. Create a Telegram bot using **@BotFather** on Telegram:
   - Open Telegram, search for `@BotFather`
   - Send `/newbot`
   - Follow the steps — give it a name and username
   - Copy the **Bot Token** it gives you

2. Find your **Chat ID**:
   - Open your new bot in Telegram and send it any message
   - Go to **Settings** → **Telegram** in the app
   - Paste your Bot Token and click **Get Chat ID** — it will detect it automatically

3. Register the webhook:
   - In **Settings** → **Telegram**, fill in the Bot Token, Chat ID, and a Webhook Secret (any random text like `mysecret123`)
   - Click **Save**, then click **Register Webhook**
   - Done — your bot is now connected

### Logging in to the bot

Before you can use the bot, you must authenticate with your app password:

1. Open your bot in Telegram
2. Type `/start`
3. It will ask for your password — send your **app login password**
4. You are logged in for **24 hours**. After that, send your password again to continue.

Your session is personal. Each person who uses the bot logs in separately with their own password.

### Bot Commands

Once logged in, you can send any of the following:

**Sales Summary** *(Owner only)*

| Command | What it does |
|---|---|
| `today` or `t` or `/today` | Today's revenue, profit & sale count |
| `week` or `w` or `/week` | This week's totals |
| `month` or `m` or `/month` | This month's totals |

**Stock**

| Command | What it does |
|---|---|
| `stock` or `s` | Overall stock count and health |
| `stock samsung` or `s samsung` | Search by brand, model, or part name |
| *(any text)* | Treated as a stock search automatically |

**Alerts**

| Command | What it does |
|---|---|
| `low` or `/lowstock` | All items at or below their alert threshold |

**General**

| Command | What it does |
|---|---|
| `help` or `/help` or `/start` | Show the command list |
| `logout` | Sign out of the bot |

### Automatic Alerts

The bot automatically sends you:

- **Low stock alerts** whenever a product falls below its threshold after a sale
- **Daily summary** every morning with yesterday's totals, profit, and any low stock items
- **License warnings** in the daily summary when your subscription is close to expiring

---

## 7. License & Subscription

### Free Trial

Your app comes with a **4-month free trial**. During the trial, all features including Telegram are fully active.

When the trial is running you will see **"Free Trial Active — X days left"** in **Settings** → **License**.

### What happens when the trial ends

When the trial expires:
- The app continues to work normally for stock and sales management
- **Telegram alerts and bot replies stop**
- You will see an **"Expired"** status in Settings → License

To restore Telegram features, you need to activate a license key (see below).

### Paid Subscription

| Plan | Price | Duration |
|---|---|---|
| Standard | **LKR 2,000** | 3 months |

To subscribe:
1. Contact HM Stocks support and make payment (details below)
2. You will receive a **license key**
3. Go to **Settings** → **License** → **Activate License Key**
4. Paste the key and click **Activate**
5. Telegram features are restored immediately

### Renewing

You can renew at any time — before or after expiry. Each key adds 3 months from the point of activation.

You will receive a **7-day warning** in your daily Telegram summary before the license expires, so you have time to renew without any interruption.

### If your access is suspended

If your subscription lapses and is suspended, you will receive a Telegram message notifying you. Simply make payment and contact support to receive a new key.

---

## 8. Support & Payment

For renewals, issues, or any help:

| | |
|---|---|
| **Name** | Heshan Kavinda |
| **Phone / WhatsApp** | 0770411504 |
| **Email** | kavindesh518716@gmail.com |
| **Payment method** | Bank transfer / Cash (contact for details) |

---

*HM Stocks — Built for your business by Heshan Kavinda.*
