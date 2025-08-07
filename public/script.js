
        let energyChart = null;
        let currentChartPeriod = 'daily';
        let deviceStatus = {};

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            initializeChart();
            refreshData();
            loadSchedules();
            loadTimers();
            
            // Auto-refresh every 30 seconds
            setInterval(refreshData, 30000);
        });

        // Show notification
        function showNotification(message, type = 'success') {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = `notification ${type} show`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }

        // Initialize Chart.js
        function initializeChart() {
            const ctx = document.getElementById('energyChart').getContext('2d');
            energyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Energy Consumption (kWh)',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#667eea',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(102, 126, 234, 0.1)'
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(102, 126, 234, 0.1)'
                            }
                        }
                    },
                    elements: {
                        point: {
                            hoverRadius: 8
                        }
                    }
                }
            });
        }

        // Refresh all data
        async function refreshData() {
            const refreshBtn = document.getElementById('refresh-btn');
            refreshBtn.innerHTML = '<span class="loading"></span> Loading...';
            
            try {
                await Promise.all([
                    loadDeviceStatus(),
                    loadDeviceInfo(),
                    loadEnergyData()
                ]);
                showNotification('Data refreshed successfully');
            } catch (error) {
                console.error('Error refreshing data:', error);
                showNotification('Failed to refresh data', 'error');
            } finally {
                refreshBtn.innerHTML = '🔄 Refresh';
            }
        }

        // Load device status
        async function loadDeviceStatus() {
            try {
                const response = await fetch('/api/device/status');
                const result = await response.json();
                
                if (result.success) {
                    deviceStatus = result.data;
                    updateStatusDisplay();
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error loading device status:', error);
                updateOfflineStatus();
            }
        }

        // Load device info
        async function loadDeviceInfo() {
            try {
                const response = await fetch('/api/device/info');
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('deviceNameInput').value = result.result.name || 'SmartPlug';
                }
            } catch (error) {
                console.error('Error loading device info:', error);
            }
        }

        // Update status display
        function updateStatusDisplay() {
            const powerSwitch = document.getElementById('powerSwitch');
            const statusText = document.getElementById('statusText');
            
            // Update power switch
            if (deviceStatus.power_switch) {
                powerSwitch.className = 'power-switch on';
                statusText.textContent = 'ONLINE';
                statusText.className = 'status-text online';
            } else {
                powerSwitch.className = 'power-switch off';
                statusText.textContent = 'OFFLINE';
                statusText.className = 'status-text offline';
            }
            
            // Update metrics
            document.getElementById('powerValue').textContent = (deviceStatus.power / 10 || 0).toFixed(1);
            document.getElementById('voltageValue').textContent = (deviceStatus.voltage / 10 || 0).toFixed(1);
            document.getElementById('currentValue').textContent = (deviceStatus.current || 0).toFixed(3);
            document.getElementById('energyValue').textContent = (deviceStatus.totalEnergy / 1000 || 0).toFixed(2);
        }

        // Update offline status
        function updateOfflineStatus() {
            const powerSwitch = document.getElementById('powerSwitch');
            const statusText = document.getElementById('statusText');
            
            powerSwitch.className = 'power-switch off';
            statusText.textContent = 'OFFLINE';
            statusText.className = 'status-text offline';
            
            // Reset metrics
            document.getElementById('powerValue').textContent = '0';
            document.getElementById('voltageValue').textContent = '0';
            document.getElementById('currentValue').textContent = '0';
            document.getElementById('energyValue').textContent = '0';
        }

        // Toggle power
        async function togglePower() {
            try {
                const newState = !deviceStatus.power_switch;
                
                const response = await fetch('/api/device/control', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        command: 'switch_1',
                        value: newState
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    deviceStatus.power_switch = newState;
                    updateStatusDisplay();
                    showNotification(`Device turned ${newState ? 'ON' : 'OFF'}`);
                } else {
                    throw new Error(result.msg || 'Failed to control device');
                }
            } catch (error) {
                console.error('Error toggling power:', error);
                showNotification('Failed to control device', 'error');
            }
        }

        // Rename device
        async function renameDevice() {
            const newName = document.getElementById('deviceNameInput').value.trim();
            
            if (!newName) {
                showNotification('Please enter a device name', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/device/rename', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: newName })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('Device renamed successfully');
                } else {
                    throw new Error(result.msg || 'Failed to rename device');
                }
            } catch (error) {
                console.error('Error renaming device:', error);
                showNotification('Failed to rename device', 'error');
            }
        }

        // Load energy data
        async function loadEnergyData() {
            try {
                const response = await fetch(`/api/energy/${currentChartPeriod}`);
                const result = await response.json();
                
                if (result.success) {
                    energyChart.data.labels = result.labels;
                    energyChart.data.datasets[0].data = result.data;
                    energyChart.update();
                }
            } catch (error) {
                console.error('Error loading energy data:', error);
            }
        }

        // Switch chart period
        function switchChart(period) {
            currentChartPeriod = period;
            
            // Update button states
            document.querySelectorAll('.chart-controls button').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            loadEnergyData();
        }

        // Set timer
        async function setTimer() {
            const minutes = parseInt(document.getElementById('timerMinutes').value);
            const action = document.getElementById('timerAction').value;
            
            if (!minutes || minutes < 1) {
                showNotification('Please enter a valid duration', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/timer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ minutes, action })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification(`Timer set for ${minutes} minutes`);
                    loadTimers();
                } else {
                    throw new Error(result.error || 'Failed to set timer');
                }
            } catch (error) {
                console.error('Error setting timer:', error);
                showNotification('Failed to set timer', 'error');
            }
        }

        // Load active timers
        async function loadTimers() {
            try {
                const response = await fetch('/api/timers');
                const result = await response.json();
                
                if (result.success) {
                    displayTimers(result.data);
                }
            } catch (error) {
                console.error('Error loading timers:', error);
            }
        }

        // Display timers
        function displayTimers(timers) {
            const container = document.getElementById('activeTimers');
            
            if (timers.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666; margin-top: 20px;">No active timers</p>';
                return;
            }
            
            container.innerHTML = '<h4 style="margin-top: 20px; margin-bottom: 10px;">Active Timers:</h4>' +
                timers.map(timer => {
                    const remaining = Math.ceil((new Date(timer.endTime) - new Date()) / 60000);
                    return `
                        <div class="schedule-item">
                            <div>
                                <strong>${timer.action.toUpperCase()}</strong><br>
                                <small>${remaining > 0 ? `${remaining} min remaining` : 'Executing...'}</small>
                            </div>
                        </div>
                    `;
                }).join('');
        }

        // Add schedule
        async function addSchedule() {
            const time = document.getElementById('scheduleTime').value;
            const daysSelect = document.getElementById('scheduleDays');
            const action = document.getElementById('scheduleAction').value;
            
            const days = Array.from(daysSelect.selectedOptions).map(option => parseInt(option.value));
            
            if (!time || days.length === 0) {
                showNotification('Please select time and days', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ time, days, action })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('Schedule added successfully');
                    loadSchedules();
                    
                    // Reset form
                    document.getElementById('scheduleTime').value = '';
                    daysSelect.selectedIndex = -1;
                } else {
                    throw new Error(result.error || 'Failed to add schedule');
                }
            } catch (error) {
                console.error('Error adding schedule:', error);
                showNotification('Failed to add schedule', 'error');
            }
        }

        // Load schedules
        async function loadSchedules() {
            try {
                const response = await fetch('/api/schedules');
                const result = await response.json();
                
                if (result.success) {
                    displaySchedules(result.data);
                }
            } catch (error) {
                console.error('Error loading schedules:', error);
            }
        }

        // Display schedules
        function displaySchedules(schedules) {
            const container = document.getElementById('scheduleList');
            
            if (schedules.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666;">No schedules configured</p>';
                return;
            }
            
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            
            container.innerHTML = schedules.map(schedule => `
                <div class="schedule-item">
                    <div>
                        <strong>${schedule.time} - ${schedule.action.toUpperCase()}</strong><br>
                        <small>${schedule.days.map(d => dayNames[d]).join(', ')}</small>
                    </div>
                    <button class="btn btn-danger" onclick="deleteSchedule(${schedule.id})">Delete</button>
                </div>
            `).join('');
        }

        // Delete schedule
        async function deleteSchedule(id) {
            try {
                const response = await fetch(`/api/schedules/${id}`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('Schedule deleted');
                    loadSchedules();
                } else {
                    throw new Error(result.error || 'Failed to delete schedule');
                }
            } catch (error) {
                console.error('Error deleting schedule:', error);
                showNotification('Failed to delete schedule', 'error');
            }
        }
