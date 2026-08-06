# Track Assistant

**Track Assistant** is a modern, AI-powered invoice and tracking dashboard built with Next.js. It leverages the Gemini API for intelligent processing, Firebase for backend services, and is fully configured as a Progressive Web App (PWA).

## 🚀 Key Features

*   **Intelligent AI Integration**: Utilizes the Google GenAI (`@google/genai`) to provide smart insights and automated processing.
*   **Modern Tech Stack**: Built with Next.js 15, React 19, and Tailwind CSS.
*   **Interactive Dashboard**:
    *   **Data Visualization**: Integrated `recharts` for charting and analytics.
    *   **Drag & Drop**: Kanban-style or sortable lists powered by `@dnd-kit`.
    *   **Date Filtering**: A highly customizable `DatePicker` component powered by `react-flatpickr`.
*   **Utility & Tools**:
    *   **QR Code Scanning**: Built-in support for scanning QR codes with `jsqr`.
    *   **Excel Export**: Easily export your tracking data and invoices to Excel using `xlsx`.
*   **PWA Ready**: Offline support and installable via `@serwist/next`.
*   **Smooth Animations**: Fluid user experience with Framer Motion (`motion`).
*   **Cloud Backend**: Real-time database and robust authentication provided by Firebase.

## 🛠️ Prerequisites

*   **Node.js** (v18 or higher recommended)
*   **Firebase Account** (for database/auth setup)
*   **Google Gemini API Key** (for AI features)

## 💻 Getting Started

1.  **Clone the repository and install dependencies:**

    ```bash
    npm install
    ```

2.  **Set up environment variables:**

    Ensure you add your `GEMINI_API_KEY` to `.env.local`:
    ```env
    GEMINI_API_KEY=your_api_key_here
    # Add your Firebase configuration keys here as well if needed
    ```

3.  **Run the development server:**

    ```bash
    npm run dev
    ```

4.  **Open the app:**
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Build for Production

To create an optimized production build:

```bash
npm run build
npm start
```

## 🧹 Code Quality

The project uses ESLint and TypeScript for type safety and code quality. You can check for linting errors by running:

```bash
npm run lint
```
