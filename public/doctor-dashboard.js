// public/doctor-dashboard.js
async function loadDoctorAppointments() {
    try {
        const response = await fetch('/api/doctor/appointments');
        const appointments = await response.json();

        const appointmentsList = document.getElementById('appointmentsList');
        appointmentsList.innerHTML = appointments.map(appointment => `
            <div class="appointment-card">
                <h3>Appointment on ${new Date(appointment.appointmentDate).toLocaleDateString()}</h3>
                <div class="appointment-info">
                    <p><strong>Patient:</strong> ${appointment.patientName}</p>
                    <p><strong>Blood Group:</strong> ${appointment.bloodGroup}</p>
                    <p><strong>Department:</strong> ${appointment.departmentName}</p>
                    <p><strong>Description:</strong> ${appointment.appointmentDescription || 'No description provided'}</p>
                </div>
                <button class="manage-tests-btn" data-appointment-id="${appointment.appointment_ID}">
                    Manage Tests
                </button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading appointments:', err);
    }
}

// Load appointments when page loads
document.addEventListener('DOMContentLoaded', loadDoctorAppointments);

// Add to doctor-dashboard.js
function openTestModal(appointmentId) {
    const modal = document.getElementById('testModal');
    modal.style.display = 'block';
    loadExistingTests(appointmentId);
    
    // Store appointment ID for adding new tests
    modal.dataset.appointmentId = appointmentId;
}
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    window.location.href = 'login.html';
});
document.getElementById('report_h')?.addEventListener('click', () => {
    window.location.href = 'index.html';
});
async function loadExistingTests(appointmentId) {
    try {
        const response = await fetch(`/api/appointments/${appointmentId}/tests`);
        const tests = await response.json();
        
        const testsContainer = document.getElementById('existingTests');
        testsContainer.innerHTML = tests.map(test => `
            <div class="test-item">
                <span>${test.testName}</span>
                <div class="test-result">
                    <input type="text" value="${test.result}" 
                           ${test.result === 'Pending' ? '' : 'readonly'}
                           data-test-id="${test.test_ID}">
                    ${test.result === 'Pending' ? 
                        `<button onclick="updateTestResult(${test.test_ID})">Update</button>` : 
                        ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading tests:', err);
    }
}

document.getElementById('addTestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const appointmentId = document.getElementById('testModal').dataset.appointmentId;
    const testName = document.getElementById('testName').value;

    try {
        const response = await fetch('/api/tests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ appointmentId, testName })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('testName').value = '';
            loadExistingTests(appointmentId);
        }
    } catch (err) {
        console.error('Error adding test:', err);
    }
});

async function updateTestResult(testId) {
    const input = document.querySelector(`input[data-test-id="${testId}"]`);
    const result = input.value;

    try {
        const response = await fetch(`/api/tests/${testId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ result })
        });

        const data = await response.json();

        if (data.success) {
            alert('Test result updated successfully');
            input.readOnly = true;
            input.nextElementSibling.remove();
        }
    } catch (err) {
        console.error('Error updating test result:', err);
    }
}

// Initialize modal functionality
document.addEventListener('DOMContentLoaded', () => {

    
    const modal = document.getElementById('testModal');
    const span = document.getElementsByClassName('close')[0];
    
    // Close modal when clicking (x)
    span.onclick = () => {
        modal.style.display = 'none';
    };

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Add click handlers for manage tests buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('manage-tests-btn')) {
            openTestModal(e.target.dataset.appointmentId);
        }

            loadDepartments();
    });
});