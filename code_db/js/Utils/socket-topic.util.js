const topics = async (socket) => {
  socket.subscription('/admin/update');
  socket.subscription('/tenants/{tenantId}/documents/stats');
  socket.subscription('/tenants/{tenantId}/documents/aiStatus');
  socket.subscription('/tenants/{tenantId}/training/aiStatus');
  socket.subscription('/tenants/{tenantId}/batch/status');
  socket.subscription('/tenants/{tenantId}/batch/{batchId}/bucket');
};

module.exports = topics;
