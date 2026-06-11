# NZ Speed Camera API

A modern, high‑performance web API for accessing New Zealand speed camera data. Built with **Node.js**, **Express**, and **TypeScript**, it provides clean, well‑documented endpoints for retrieving camera locations, recent speed violations, and statistical summaries.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [API Endpoints](#api-endpoints)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **RESTful JSON API** with clear versioning (`/v1`).
- **TypeScript** for type safety and autocomplete.
- **Comprehensive validation** using `zod`.
- **Swagger UI** for interactive documentation at `/docs`.
- **Dockerized** for easy deployment.
- **Rate limiting** and **CORS** protections.
- **Extensible** architecture – plug‑in new data sources with minimal effort.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your‑org/nz-speed-camera-api.git
cd nz-speed-camera-api

# Install dependencies using pnpm (recommended) or npm/yarn
pnpm install
```

> **Note**: This project uses **Node 20**. Ensure it is installed on your machine.

---

## Running Locally

```bash
# Development mode with hot‑reloading
pnpm dev

# Production build
pnpm build
pnpm start
```

The API will be available at `http://localhost:3000`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/cameras` | List all speed cameras with pagination. |
| `GET` | `/v1/cameras/:id` | Retrieve details for a specific camera. |
| `GET` | `/v1/violations` | Get recent speed violations, filterable by date and location. |
| `GET` | `/v1/stats` | Summary statistics (total cameras, average speed, etc.). |
| `GET` | `/docs` | Swagger UI for interactive API exploration. |

All responses follow a consistent JSON schema defined in `src/types/*.ts`.

---

## Development

### Project Structure

```
src/
├─ config/          # Configuration files (environment, logger)
├─ controllers/     # Request handlers
├─ routes/          # Express route definitions
├─ services/        # Business logic and external API integrations
├─ models/          # TypeScript interfaces / types
├─ middleware/      # Validation, error handling, auth
└─ index.ts         # Application entry point
```

### Linting & Formatting

```bash
pnpm lint      # Run ESLint
pnpm format    # Run Prettier
```

### Generating API Docs

Swagger docs are generated from JSDoc comments. Run:

```bash
pnpm docs
```

---

## Testing

```bash
# Unit & integration tests
pnpm test

# Test coverage report
pnpm test:coverage
```

Tests are written with **Jest** and **SuperTest**.

---

## Deployment

The repository includes a Dockerfile for containerisation.

```bash
# Build Docker image
docker build -t nz-speed-camera-api:latest .

# Run container
docker run -p 3000:3000 nz-speed-camera-api
```

For cloud deployment (e.g., GCP Cloud Run, AWS ECS) configure the appropriate CI/CD pipeline.

---

## Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to submit pull requests, report bugs, or propose new features.

---

## License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

---

*Made with ❤️ by the NZ Speed Camera API team.*
