// models/index.js
// Para isang require lang sa lahat ng models

module.exports = {
  User: require('./User'),
  Customer: require('./Customer'),
  Staff: require('./Staff'),
  Service: require('./Service'),
  Appointment: require('./Appointment'),
  AppointmentService: require('./AppointmentService'),
  Payment: require('./Payment'),
  StaffSchedule: require('./StaffSchedule'),
  BlockedSchedule: require('./BlockedSchedule'),
  AppointmentHistory: require('./AppointmentHistory'),
  OTP: require('./OTP')
};