# Driver verification documents

The deployed app uses this workflow. For a new development project, apply setup.sql first, then document-review-setup.sql once. The document snapshot is not an idempotent rerun script.

- Driver: Profile → Documents & Verification (`/#/driver/documents`). Upload JPG, PNG, WebP or PDF up to 10 MB. Each upload is submitted for review immediately.
- Admin: Driver Documents (`/#/admin/documents`), or Drivers → Review registered driver documents. Select a real registered driver. Open/download the file, approve it, or request a replacement with a reason.
- Types: license front, license back, vehicle insurance, national ID/passport, background check.
- The driver sees the decision and note after using Refresh documents or reopening the page.
- Files are stored in the private `driver-documents` bucket using authenticated downloads, not public URLs. Only their owner (an enabled driver) and active admins can read them. Customers, other drivers and removed accounts cannot read them.
- Replacements use new immutable file paths and increment the document version. Previous review decisions remain in history; replacements start pending. Version checks reject stale reviews and concurrent replacements.
- Approval of documents does not automatically approve the driver account or authorize payments. Those workflows remain separate.
- Legacy local files/names are not automatically sent to Supabase. Drivers must upload those files again. Avatars and other local demo workflows are unchanged.
- Submitted versions are retained in private storage for review history. There is no permanent-delete UI or automatic retention schedule yet.

Implementation: dist/cloud-documents.js and dist/document-store.js. Database snapshot: supabase/document-review-setup.sql (already applied; not an idempotent rerun script).

Validation: npm test includes document-store tests. tests/document-permissions.sql checks database permissions, review ownership, status/version transitions and audit history in a transaction and rolls all fixtures back. It requires an enabled driver and active admin account and a driver with no existing insurance document; run in a test workspace before seeding real documents.
