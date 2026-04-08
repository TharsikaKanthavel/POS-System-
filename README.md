# SAAI POS - Point of Sale Application

A comprehensive desktop Point of Sale (POS) application built with React, Vite, and Electron. This application provides a complete retail management solution with inventory tracking, sales processing, customer management, and advanced analytics powered by AI.

## Features

### Core POS Functionality
- **Product Management**: Add, edit, and organize products with categories, brands, and pricing
- **Sales Processing**: Real-time cart management, checkout, and receipt generation
- **Inventory Control**: Stock tracking, quantity adjustments, and low stock alerts
- **Customer Management**: Customer database with purchase history and loyalty features

### Advanced Features
- **AI-Powered Analytics**: Intelligent sales forecasting and performance insights using TensorFlow.js
- **AI Chatbot**: Integrated chatbot for customer support and order assistance
- **Reporting System**: Comprehensive reports including sales, inventory, expenses, and profit analysis
- **User Management**: Multi-user support with role-based access control
- **Offline Capability**: Works offline with local database synchronization
- **Barcode Support**: Generate and scan barcodes for products
- **Expense Tracking**: Monitor business expenses and categorize them
- **Purchase Orders**: Manage supplier purchases and quotations
- **Returns Management**: Handle product returns and refunds
- **Shift Management**: Register and track employee shifts
- **Backup & Restore**: Automatic and manual data backup services

### Technical Features
- **Cross-Platform**: Runs on Windows, macOS, and Linux via Electron
- **Progressive Web App**: Can be installed as a PWA for web access
- **Real-time Notifications**: In-app notification system
- **Print Support**: Direct printing for receipts and labels
- **LAN Sharing**: Share data across multiple devices on local network

## Technology Stack

- **Frontend**: React 19 with React Router
- **Build Tool**: Vite
- **Desktop Framework**: Electron
- **Database**: IndexedDB with Dexie
- **AI/ML**: TensorFlow.js
- **Charts**: Recharts
- **Icons**: React Icons
- **Styling**: CSS Modules
- **Barcode Generation**: react-barcode
- **Print Functionality**: react-to-print

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd pos-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. For desktop app development:
   ```bash
   npm run electron:dev
   ```

## Building

### Web Build
```bash
npm run build
```

### Desktop App Build
```bash
npm run electron:build
```

This will create distributable packages in the `dist-electron-build` directory.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── pos/            # POS-specific components
│   └── ...
├── pages/              # Main application pages
│   ├── auth/           # Authentication pages
│   ├── people/         # User management
│   ├── products/       # Product management
│   ├── reports/        # Reporting pages
│   └── sales/          # Sales management
├── context/            # React context providers
├── services/           # Business logic and API services
├── utils/              # Utility functions
└── assets/             # Static assets
```

## Key Components

- **POS System**: Complete point of sale with cart, checkout, and payment processing
- **Dashboard**: Overview of sales, inventory, and key metrics
- **Product Management**: CRUD operations for products with advanced filtering
- **Customer Database**: Customer profiles with purchase history
- **Reports & Analytics**: Various reports with AI-powered insights
- **Settings**: Configurable application settings and preferences

## Database

The application uses IndexedDB through Dexie for local data storage, providing:
- Offline functionality
- Fast local queries
- Automatic synchronization
- Data persistence across sessions

## AI Features

- **Sales Forecasting**: Predict future sales based on historical data
- **Inventory Optimization**: Suggest optimal stock levels
- **Customer Insights**: Analyze customer behavior patterns
- **Chatbot**: AI-powered customer assistance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request


# POS-System-
This is a desktop Point of Sale application
