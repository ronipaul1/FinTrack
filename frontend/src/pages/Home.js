import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiShield,
  FiTrendingUp,
  FiPieChart,
  FiFileText,
  FiBell,
  FiBookOpen,
  FiCheck
} from 'react-icons/fi';

const features = [
  {
    icon: FiTrendingUp,
    title: 'Track Income & Expenses',
    description: 'Keep your income and spending organized in one place.'
  },
  {
    icon: FiPieChart,
    title: 'Understand Your Finances',
    description: 'See where your money goes with clear financial analytics.'
  },
  {
    icon: FiFileText,
    title: 'Manage Invoices',
    description: 'Create and manage invoices without complicated tools.'
  },
  {
    icon: FiBookOpen,
    title: 'Digital Account Book',
    description: 'Maintain a simple digital record of your financial activity.'
  },
  {
    icon: FiBell,
    title: 'Smart Reminders',
    description: 'Stay on top of important payments and financial tasks.'
  },
  {
    icon: FiShield,
    title: 'Secure by Design',
    description: 'Your account is protected with authentication and secure password handling.'
  }
];

const Home = () => {
  return (
    <div className="home-page">

      {/* Navbar */}
      <nav className="home-nav">
        <Link to="/" className="home-brand">
          <img src="/favicon.png" alt="FinTrack" />
          <div>
            <strong>FinTrack</strong>
            <span>SMART MONEY MANAGER</span>
          </div>
        </Link>

        <div className="home-nav-actions">
          <Link to="/login" className="btn btn-outline">
            Sign In
          </Link>

          <Link to="/register" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="home-hero">

        <div className="home-hero-content">
          <div className="home-badge">
            <FiShield />
            <span>Simple. Smart. Secure.</span>
          </div>

          <h1>
            Take Control of
            <span> Your Money.</span>
          </h1>

          <p>
            FinTrack helps you manage income, expenses, savings,
            invoices and financial activity from one secure workspace.
          </p>

          <div className="home-hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">
              Start Managing Your Money
              <FiArrowRight />
            </Link>

            <Link to="/login" className="btn btn-outline btn-lg">
              Sign In
            </Link>
          </div>

          <div className="home-trust">
            <span>
              <FiCheck /> Easy to use
            </span>
            <span>
              <FiCheck /> All-in-one finance management
            </span>
            <span>
              <FiCheck /> Secure authentication
            </span>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="home-hero-visual">
          <div className="home-glow"></div>

          <div className="home-dashboard-preview">
            <div className="preview-header">
              <div>
                <small>FINTRACK</small>
                <h3>Financial Overview</h3>
              </div>

              <div className="preview-logo">
                <img src="/favicon.png" alt="" />
              </div>
            </div>

            <div className="preview-balance">
              <small>Total Balance</small>
              <strong>₹84,250</strong>
              <span>+12.8% this month</span>
            </div>

            <div className="preview-cards">
              <div>
                <small>Income</small>
                <strong>₹52,400</strong>
              </div>

              <div>
                <small>Expenses</small>
                <strong>₹21,850</strong>
              </div>

              <div>
                <small>Savings</small>
                <strong>₹30,550</strong>
              </div>
            </div>

            <div className="preview-chart">
              <div style={{ height: '35%' }}></div>
              <div style={{ height: '48%' }}></div>
              <div style={{ height: '42%' }}></div>
              <div style={{ height: '62%' }}></div>
              <div style={{ height: '55%' }}></div>
              <div style={{ height: '78%' }}></div>
              <div style={{ height: '90%' }}></div>
            </div>
          </div>
        </div>

      </section>

      {/* Features */}
      <section className="home-section">
        <div className="home-section-heading">
          <span>EVERYTHING IN ONE PLACE</span>
          <h2>Manage your money without the mess.</h2>
          <p>
            Everything you need to understand and organize your
            personal finances.
          </p>
        </div>

        <div className="home-features">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div className="home-feature-card" key={feature.title}>
                <div className="home-feature-icon">
                  <Icon />
                </div>

                <h3>{feature.title}</h3>

                <p>{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Security */}
      <section className="home-security">
        <div className="home-security-icon">
          <FiShield />
        </div>

        <div>
          <span>YOUR FINANCES. YOUR CONTROL.</span>

          <h2>
            Built with security in mind.
          </h2>

          <p>
            FinTrack uses secure authentication and protected
            account access to help keep your financial information
            private.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="home-cta">
        <h2>Ready to take control?</h2>

        <p>
          Start organizing your finances with FinTrack.
        </p>

        <Link to="/register" className="btn btn-primary btn-lg">
          Create Your Account
          <FiArrowRight />
        </Link>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div>
          <strong>FinTrack</strong>
          <span>Smart Money Manager</span>
        </div>

        <p>© 2026 FinTrack. All rights reserved.</p>
      </footer>

    </div>
  );
};

export default Home;
