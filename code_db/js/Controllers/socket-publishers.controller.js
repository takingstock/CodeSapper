const PUBLISH_ADMIN_UPDATE = (socket, payload) => {
  console.log("PUBLISH_ADMIN_UPDATE socket fired")
  socket.publish(`/admin/update`, payload);
};

const PUBLISH_DASHBOARD_STATS = (socket, tenantId, payload) => {
  socket.publish(`/tenants/${tenantId}/dashboard/stats`, payload);
};

const PUBLISH_AI_STATUS_DOCUMENTS = (socket, tenantId, payload) => {
  PUBLISH_ADMIN_UPDATE(socket, { type: PUBLISH_AI_STATUS_DOCUMENTS })
  socket.publish(`/tenants/${tenantId}/documents/aiStatus`, payload);
};

const PUBLISH_AI_STATUS_TRAINING = (socket, tenantId, payload) => {
  socket.publish(`/tenants/${tenantId}/training/aiStatus`, payload);
};
const PUBLISH_AI_STATUS_BATCH = (socket, tenantId, payload) => {
  socket.publish(`/tenants/${tenantId}/batch/status`, payload);
};

const PUBLISH_BUCKET_STATUS_BATCH = (socket, tenantId, batchId, payload) => {
  socket.publish(`/tenants/${tenantId}/batch/${batchId}/bucket`, payload);
};
const PUBLISH_SUPER_ADMIN = (socket, payload) => {
  socket.publish(`/superadmin`, payload);
}

module.exports = {
  PUBLISH_DASHBOARD_STATS,
  PUBLISH_AI_STATUS_DOCUMENTS,
  PUBLISH_AI_STATUS_TRAINING,
  PUBLISH_AI_STATUS_BATCH,
  PUBLISH_BUCKET_STATUS_BATCH,
  PUBLISH_ADMIN_UPDATE,
  PUBLISH_SUPER_ADMIN
};
