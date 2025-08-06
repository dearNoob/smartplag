
# SmartPlug Dashboard

A comprehensive web dashboard for controlling and monitoring smart plugs using the Tuya Developer API. Built with Node.js, Express.js, and vanilla HTML/CSS/JavaScript.

## Features

✅ **Real-time Monitoring**
- Device ON/OFF status
- Live power consumption (W)
- Voltage (V) and Current (A) readings
- Total energy consumption tracking

✅ **Device Control**
- Remote ON/OFF toggle
- Device renaming
- Timer-based control
- Scheduling system

✅ **Data Visualization**
- Interactive energy usage charts (Chart.js)
- Daily, weekly, and monthly trends
- Real-time metrics display

✅ **Security & UX**
- Session-based authentication
- Mobile-responsive design
- Auto-refresh functionality
- Real-time notifications

## Prerequisites

- Node.js (v14 or higher)
- Tuya Developer Account with API credentials
- Compatible smart plug device

## Installation

1. **Clone or create project directory:**
```bash
mkdir smartplug-dashboard
cd smartplug-dashboard
```

2. **Install dependencies:**
```bash
npm npm install express axios express-session
```

3. **Update API credentials in `server.js`:**
```javascript
const config = {
    clientId: 'your_client_id_here',
    clientSecret: 'your_client_secret_here',
    deviceId: 'your_device_id_here',
    baseUrl: 'https://openapi.tuyaeu.com', // Change region if needed
    region: 'eu'
};
```

4. **Create the `public` directory:**
```bash
mkdir public
```

5. **Move `index.html` to the `public` directory**

## Directory Structure

```
smartplug-dashboard/
├── server.js          # Main backend server
├── package.json       # Dependencies
├── README.md          # This file
└── public/
    └── index.html     # Frontend dashboard
```

## Usage

1. **Start the server:**
```bash
npm start
```

2. **For development (with auto-restart):**
```bash
npm run dev
```

3. **Access the dashboard:**
- Open your browser and go to: `http://localhost:3000`
- Default login credentials:
  - Username: `admin`
  - Password: `smartplug123`

## API Endpoints

### Authentication
- `GET /login` - Login page
- `POST /login` - Authenticate user
- `POST /logout` - Logout user

### Device Control
- `GET /api/device/status` - Get device status
- `POST /api/device/control` - Control device (ON/OFF)
- `GET /api/device/info` - Get device information
- `POST /api/device/rename` - Rename device

### Energy & Scheduling
- `GET /api/energy/:period` - Get energy data (daily/weekly/monthly)
- `GET /api/schedules` - Get all schedules
- `POST /api/schedules` - Add new schedule
- `DELETE /api/schedules/:id` - Delete schedule
- `POST /api/timer` - Set timer
- `GET /api/timers` - Get active timers

## Configuration

### Tuya API Setup

1. **Create Tuya Developer Account:**
   - Go to https://iot.tuya.com/
   - Create an account and verify email

2. **Create Cloud Project:**
   - Navigate to "Cloud" → "Projects"
   - Create new project
   - Note down the Access ID and Access Secret

3. **Add Device:**
   - Go to "Devices" → "Add Device"
   - Follow pairing instructions for your smart plug
   - Note down the Device ID

4. **API Authorization:**
   - Go to "Cloud" → "API Explorer"
   - Test your API access with device status calls

### Changing Data Center Region

Update the `baseUrl` in `server.js` for your region:

- **US:** `https://openapi.tuyaus.com`
- **EU:** `https://openapi.tuyaeu.com`
- **China:** `https://openapi.tuyacn.com`
- **India:** `https://openapi.tuyain.com`

## Security Notes

⚠️ **Important Security Considerations:**

1. **Change default login credentials** in production
2. **Use environment variables** for API credentials:
```javascript
const config = {
    clientId: process.env.TUYA_CLIENT_ID,
    clientSecret: process.env.TUYA_CLIENT_SECRET,
    deviceId: process.env.TUYA_DEVICE_ID,
    // ...
};
```

3. **Implement proper user management** for multi-user scenarios
4. **Use HTTPS** in production
5. **Add rate limiting** for API endpoints

## Customization

### Adding Multiple Devices
To support multiple devices, modify the `config` object to include an array of devices and update the API routes accordingly.

### Custom Styling
Update the CSS in `public/index.html` to match your preferred design theme.

### Additional Metrics
Add support for more device parameters by modifying the status parsing logic in the `/api/device/status` endpoint.

## Troubleshooting

### Common Issues

1. **"Token generation failed"**
   - Verify API credentials are correct
   - Check data center region setting
   - Ensure device is online and linked to your account

2. **"Device not responding"**
   - Check device connectivity
   - Verify Device ID is correct
   - Ensure device is properly paired with Tuya app

3. **"Authentication required" errors**
   - Clear browser session/cookies
   - Restart the server
   - Check session configuration

### Debug Mode

Enable debug logging by setting:
```javascript
process.env.NODE_ENV = 'development';
```

## Future Enhancements

- [ ] Database integration for historical data
- [ ] Email/SMS notifications
- [ ] Multiple device support
- [ ] Advanced scheduling (sunrise/sunset)
- [ ] Energy cost calculations
- [ ] Data export functionality
- [ ] Mobile app integration

## License

MIT License - feel free to modify and distribute.

## Support

For issues and questions:
1. Check the Tuya Developer documentation
2. Review the troubleshooting section
3. Check device compatibility with Tuya OpenAPI

---

**Note:** This dashboard uses mock data for energy trends initially. To implement real historical data, consider integrating with a database system like MongoDB or PostgreSQL to store and retrieve device metrics over time.
