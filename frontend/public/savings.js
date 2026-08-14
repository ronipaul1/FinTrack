const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pool = require('../config/database');
const auth = require('../middleware/auth');

// =====================================================
// MULTER - Savings Receipt Upload
// =====================================================

const uploadDir = path.join(__dirname, '../uploads/savings');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    cb(
      null,
      `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.pdf'
    ];

    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Only JPG, JPEG, PNG, WEBP and PDF files are allowed'
        )
      );
    }
  }
});

// =====================================================
// CONSTANTS
// =====================================================

const INVESTMENT_TYPES = [
  'fd',
  'stock',
  'mutual_fund',
  'gold',
  'silver',
  'ppf',
  'bond',
  'crypto',
  'other'
];

const INVESTMENT_STATUSES = [
  'active',
  'matured',
  'withdrawn'
];

// =====================================================
// GET ALL SAVINGS / INVESTMENTS
// GET /api/savings
// =====================================================

router.get('/', auth, async (req, res) => {
  try {
    const {
      type,
      status,
      search
    } = req.query;

    let sql = `
      SELECT *
      FROM savings
      WHERE user_id = ?
    `;

    const params = [req.userId];

    // Filter by investment type
    if (type && INVESTMENT_TYPES.includes(type)) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    // Filter by status
    if (
      status &&
      INVESTMENT_STATUSES.includes(status)
    ) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    // Search
    if (search && search.trim()) {
      sql += `
        AND (
          name LIKE ?
          OR provider LIKE ?
          OR platform LIKE ?
          OR custom_message LIKE ?
        )
      `;

      const searchValue = `%${search.trim()}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    sql += `
      ORDER BY
        CASE
          WHEN status = 'active' THEN 0
          WHEN status = 'matured' THEN 1
          WHEN status = 'withdrawn' THEN 2
          ELSE 3
        END,
        booked_date DESC,
        created_at DESC
    `;

    const [rows] = await pool.execute(
      sql,
      params
    );

    const investments = rows.map(row => ({
      ...row,

      amount:
        row.amount !== null
          ? parseFloat(row.amount)
          : 0,

      current_value:
        row.current_value !== null
          ? parseFloat(row.current_value)
          : null,

      withdrawn_amount:
        row.withdrawn_amount !== null
          ? parseFloat(row.withdrawn_amount)
          : null,

      details:
        typeof row.details === 'string'
          ? safeJsonParse(row.details)
          : row.details || {}
    }));

    res.json(investments);

  } catch (error) {
    console.error(
      'Get savings error:',
      error
    );

    res.status(500).json({
      error: 'Failed to fetch savings'
    });
  }
});

// =====================================================
// GET SUMMARY
// GET /api/savings/summary
// =====================================================

router.get(
  '/summary',
  auth,
  async (req, res) => {
    try {

      const [rows] = await pool.execute(
        `
        SELECT

          COUNT(*) AS total_investments,

          COALESCE(
            SUM(
              CASE
                WHEN status != 'withdrawn'
                THEN amount
                ELSE 0
              END
            ),
            0
          ) AS total_invested,

          COALESCE(
            SUM(
              CASE
                WHEN status != 'withdrawn'
                THEN COALESCE(
                  current_value,
                  amount
                )
                ELSE 0
              END
            ),
            0
          ) AS current_value,

          COALESCE(
            SUM(
              CASE
                WHEN status = 'withdrawn'
                THEN withdrawn_amount
                ELSE 0
              END
            ),
            0
          ) AS withdrawn_value

        FROM savings
        WHERE user_id = ?
        `,
        [req.userId]
      );

      const summary = rows[0];

      res.json({
        total_investments:
          Number(
            summary.total_investments
          ),

        total_invested:
          parseFloat(
            summary.total_invested
          ),

        current_value:
          parseFloat(
            summary.current_value
          ),

        withdrawn_value:
          parseFloat(
            summary.withdrawn_value
          )
      });

    } catch (error) {

      console.error(
        'Savings summary error:',
        error
      );

      res.status(500).json({
        error:
          'Failed to fetch savings summary'
      });
    }
  }
);

// =====================================================
// GET SINGLE INVESTMENT
// GET /api/savings/:id
// =====================================================

router.get(
  '/:id',
  auth,
  async (req, res) => {
    try {

      const [rows] = await pool.execute(
        `
        SELECT *
        FROM savings
        WHERE id = ?
        AND user_id = ?
        `,
        [
          req.params.id,
          req.userId
        ]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          error: 'Investment not found'
        });
      }

      const investment = rows[0];

      investment.amount =
        parseFloat(investment.amount);

      if (
        investment.current_value !== null
      ) {
        investment.current_value =
          parseFloat(
            investment.current_value
          );
      }

      if (
        investment.withdrawn_amount !== null
      ) {
        investment.withdrawn_amount =
          parseFloat(
            investment.withdrawn_amount
          );
      }

      investment.details =
        typeof investment.details === 'string'
          ? safeJsonParse(
              investment.details
            )
          : investment.details || {};

      res.json(investment);

    } catch (error) {

      console.error(
        'Get investment error:',
        error
      );

      res.status(500).json({
        error:
          'Failed to fetch investment'
      });
    }
  }
);

// =====================================================
// ADD INVESTMENT
// POST /api/savings
// =====================================================

router.post(
  '/',
  auth,
  upload.single('receipt'),

  [
    body('type')
      .isIn(INVESTMENT_TYPES)
      .withMessage(
        'Invalid investment type'
      ),

    body('name')
      .trim()
      .notEmpty()
      .withMessage(
        'Investment name is required'
      ),

    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage(
        'Amount must be greater than zero'
      ),

    body('booked_date')
      .isDate()
      .withMessage(
        'Valid booked date is required'
      )
  ],

  async (req, res) => {

    const errors =
      validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    try {

      const {
        type,
        name,
        amount,
        current_value,
        booked_date,
        maturity_date,
        provider,
        platform,
        custom_message,
        details
      } = req.body;

      const id = uuidv4();

      let detailsJson = {};

      if (details) {
        try {
          detailsJson =
            typeof details === 'string'
              ? JSON.parse(details)
              : details;
        } catch (error) {
          return res.status(400).json({
            error:
              'Invalid investment details'
          });
        }
      }

      const receipt_url =
        req.file
          ? `/uploads/savings/${req.file.filename}`
          : null;

      await pool.execute(
        `
        INSERT INTO savings (
          id,
          user_id,
          type,
          name,
          amount,
          current_value,
          booked_date,
          maturity_date,
          provider,
          platform,
          receipt_url,
          custom_message,
          status,
          details
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, 'active', ?
        )
        `,
        [
          id,
          req.userId,
          type,
          name,
          amount,
          current_value || null,
          booked_date,
          maturity_date || null,
          provider || null,
          platform || null,
          receipt_url,
          custom_message || null,
          JSON.stringify(detailsJson)
        ]
      );

      const [rows] =
        await pool.execute(
          `
          SELECT *
          FROM savings
          WHERE id = ?
          AND user_id = ?
          `,
          [
            id,
            req.userId
          ]
        );

      res.status(201).json(
        rows[0]
      );

    } catch (error) {

      console.error(
        'Add savings error:',
        error
      );

      res.status(500).json({
        error:
          'Failed to add investment'
      });
    }
  }
);

// =====================================================
// UPDATE INVESTMENT
// PUT /api/savings/:id
// =====================================================

router.put(
  '/:id',
  auth,
  upload.single('receipt'),

  async (req, res) => {

    const { id } = req.params;

    try {

      // Check ownership
      const [existing] =
        await pool.execute(
          `
          SELECT *
          FROM savings
          WHERE id = ?
          AND user_id = ?
          `,
          [
            id,
            req.userId
          ]
        );

      if (existing.length === 0) {
        return res.status(404).json({
          error:
            'Investment not found'
        });
      }

      const {
        type,
        name,
        amount,
        current_value,
        booked_date,
        maturity_date,
        provider,
        platform,
        custom_message,
        details,
        status,
        withdrawn_date,
        withdrawn_amount
      } = req.body;

      // Validate type if provided
      if (
        type &&
        !INVESTMENT_TYPES.includes(type)
      ) {
        return res.status(400).json({
          error:
            'Invalid investment type'
        });
      }

      // Validate status
      if (
        status &&
        !INVESTMENT_STATUSES.includes(
          status
        )
      ) {
        return res.status(400).json({
          error:
            'Invalid investment status'
        });
      }

      let detailsJson =
        existing[0].details || {};

      if (details) {
        try {
          detailsJson =
            typeof details === 'string'
              ? JSON.parse(details)
              : details;
        } catch (error) {
          return res.status(400).json({
            error:
              'Invalid investment details'
          });
        }
      }

      let receipt_url;

      if (req.file) {
        receipt_url =
          `/uploads/savings/${req.file.filename}`;
      }

      let sql = `
        UPDATE savings
        SET
          type = ?,
          name = ?,
          amount = ?,
          current_value = ?,
          booked_date = ?,
          maturity_date = ?,
          provider = ?,
          platform = ?,
          custom_message = ?,
          status = ?,
          withdrawn_date = ?,
          withdrawn_amount = ?,
          details = ?
      `;

      const params = [
        type || existing[0].type,

        name || existing[0].name,

        amount !== undefined
          ? amount
          : existing[0].amount,

        current_value !== undefined &&
        current_value !== ''
          ? current_value
          : null,

        booked_date ||
          existing[0].booked_date,

        maturity_date || null,

        provider || null,

        platform || null,

        custom_message || null,

        status ||
          existing[0].status,

        withdrawn_date || null,

        withdrawn_amount || null,

        JSON.stringify(detailsJson)
      ];

      if (receipt_url) {
        sql += `,
          receipt_url = ?
        `;

        params.push(receipt_url);
      }

      sql += `
        WHERE id = ?
        AND user_id = ?
      `;

      params.push(
        id,
        req.userId
      );

      await pool.execute(
        sql,
        params
      );

      const [updated] =
        await pool.execute(
          `
          SELECT *
          FROM savings
          WHERE id = ?
          AND user_id = ?
          `,
          [
            id,
            req.userId
          ]
        );

      res.json(
        updated[0]
      );

    } catch (error) {

      console.error(
        'Update savings error:',
        error
      );

      res.status(500).json({
        error:
          'Failed to update investment'
      });
    }
  }
);

// =====================================================
// MARK INVESTMENT AS MATURED
// POST /api/savings/:id/mature
// =====================================================

router.post(
  '/:id/mature',
  auth,
  async (req, res) => {

    try {

      const [existing] =
        await pool.execute(
          `
          SELECT id
          FROM savings
          WHERE id = ?
          AND user_id = ?
          `,
          [
            req.params.id,
            req.userId
          ]
        );

      if (existing.length === 0) {
        return res.status(404).json({
          error:
            'Investment not found'
        });
      }

      await pool.execute(
        `
        UPDATE savings
        SET status = 'matured'
        WHERE id = ?
        AND user_id = ?
        `,
        [
          req.params.id,
          req.userId
        ]
      );

      const [updated] =
        await pool.execute(
          `
          SELECT *
          FROM savings
          WHERE id = ?
          AND user_id = ?
          `,
          [
            req.params.id,
            req.userId
          ]
        );

      res.json(
        updated[0]
      );

    } catch (error) {

      console.error(
        'Mature investment error:',
        error
      );

      res.status(500).json({
        error:
          'Failed to mark investment as matured'
      });
    }
  }
);

// =====================================================
// WITHDRAW INVESTMENT
// POST /api/savings/:id/withdraw
// =====================================================

router.post(
  '/:id/withdraw',
  auth,
  [
    body('withdrawn_date')
      .isDate()
      .withMessage(
        'Valid withdrawal date is required'
      ),

    body('withdrawn_amount')
      .isFloat({ min: 0.01 })
      .withMessage(
        'Valid withdrawal amount is required'
      )
  ],

  async (req, res) => {

    const errors =
      validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    try {

      const {
        withdrawn_date,
        withdrawn_amount
      } = req.body;

      const [existing] =
        await pool.execute(
          `
          SELECT *
          FROM savings
          WHERE id = ?
          AND user_id = ?
          `,
          [
            req.params.id,
            req.userId
          ]
        );

      if (existing.length === 0) {
        return res.status(404).json({
          error:
            'Investment not found'
        });
      }

      if (
        existing[0].status ===
        'withdrawn'
      ) {
        return res.status(400).json({
          error:
            'Investment is already withdrawn'
        });
      }

      await pool.execute(
        `
        UPDATE savings
        SET
          status = 'withdrawn',
          withdrawn_date = ?,
          withdrawn_amount = ?,
          current_value = ?
        WHERE id = ?
        AND user_id = ?
        `,
        [
          withdrawn_date,
          withdrawn_amount,
          withdrawn_amount,
          req.params.id,
          req.userId
        ]
      );

      const [updated] =
        await pool.execute(
          `
          SELECT *
          FROM savings
          WHERE id = ?
          AND user_id = ?
          `,
          [
            req.params.id,
            req.userId
          ]
        );

      res.json(
        updated[0]
      );

    } catch (error) {

      console.error(
        'Withdraw investment error:',
        error
      );

      res.status(500).json({
        error:
          'Failed to withdraw investment'
      });
    }
  }
);

// =====================================================
// DELETE INVESTMENT
// DELETE /api/savings/:id
// =====================================================

router.delete(
  '/:id',
  auth,
  async (req, res) => {

    try {

      const [result] =
        await pool.execute(
          `
          DELETE FROM savings
          WHERE id = ?
          AND user_id = ?
          `,
          [
            req.params.id,
            req.userId
          ]
        );

      if (
        result.affectedRows === 0
      ) {
        return res.status(404).json({
          error:
            'Investment not found'
        });
      }

      res.json({
        message:
          'Investment deleted successfully'
      });

    } catch (error) {

      console.error(
        'Delete savings error:',
        error
      );

      res.status(500).json({
        error:
          'Failed to delete investment'
      });
    }
  }
);

// =====================================================
// HELPER
// =====================================================

function safeJsonParse(value) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

module.exports = router;
