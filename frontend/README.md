# ERP Marketplace Frontend

A professional Next.js 14 frontend application for the ERP Marketplace AI system.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS (teal/blue theme)
- **Data Fetching**: React Query (@tanstack/react-query)
- **HTTP Client**: Axios
- **UI**: Responsive, mobile-first dashboard design

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with stats and recent products |
| `/products` | Product list with search, filter, pagination |
| `/products/new` | Create a new product |
| `/products/[id]/edit` | Edit an existing product |

## Getting Started

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# For local backend development
NEXT_PUBLIC_API_URL=http://localhost:5000

# For production API
# NEXT_PUBLIC_API_URL=https://multiengined-kylan-ulcerously.ngrok-free.dev
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for production

```bash
npm run build
npm run start
```

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout (Header + QueryProvider)
│   │   ├── globals.css         # Global styles
│   │   ├── page.tsx            # Dashboard page
│   │   └── products/
│   │       ├── page.tsx        # Products list
│   │       ├── new/
│   │       │   └── page.tsx    # Create product
│   │       └── [id]/
│   │           └── edit/
│   │               └── page.tsx # Edit product
│   ├── components/             # Reusable UI components
│   │   ├── Header.tsx
│   │   ├── ProductTable.tsx
│   │   ├── ProductForm.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorAlert.tsx
│   │   ├── SuccessNotification.tsx
│   │   └── QueryProvider.tsx
│   ├── lib/
│   │   └── api.ts              # Axios API client
│   └── types/
│       └── index.ts            # TypeScript types
├── .env.local.example
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `https://multiengined-kylan-ulcerously.ngrok-free.dev` |

## API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Fetch all products |
| GET | `/api/products/:id` | Fetch single product |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
