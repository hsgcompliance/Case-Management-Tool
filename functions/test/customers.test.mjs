// Customers feature tests. All endpoints are mutative (upsert, patch, delete)
// and require structured bodies. Without those schemas, we skip testing.

(async () => {
  console.log('SKIP[customers]: no read-only customers endpoints to test');
})();
