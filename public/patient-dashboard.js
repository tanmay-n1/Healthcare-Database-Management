// public/patient-dashboard.js
async function loadPatientAppointments() {
    try {
        const response = await fetch('/api/patient/appointments');
        const appointments = await response.json();

        const appointmentsList = document.getElementById('appointmentsList');
        appointmentsList.innerHTML = appointments.map(appointment => {
            // Create a date object and adjust for timezone
            const appointmentDate = new Date(appointment.appointmentDate);
            // Add the timezone offset to get the correct local date
            appointmentDate.setMinutes(appointmentDate.getMinutes() + appointmentDate.getTimezoneOffset());
            
            return `
                <div class="appointment-card">
                    <h3>Appointment on ${appointmentDate.toDateString()}</h3>
                    <div class="appointment-info">
                        <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
                        <p><strong>Department:</strong> ${appointment.departmentName}</p>
                        <p><strong>Description:</strong> ${appointment.appointmentDescription || 'No description provided'}</p>
                    </div>
                    <button class="view-tests-btn" data-appointment-id="${appointment.appointment_ID}">
                        View Tests
                    </button>
                    <button class="delete-appointment-btn" data-appointment-id="${appointment.appointment_ID}">Delete Appointment</button>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error loading appointments:', err);
    }
}

// Load appointments when page loads
document.addEventListener('DOMContentLoaded', loadPatientAppointments);
document.addEventListener('DOMContentLoaded', loadDepartments);

// Add logout functionality to both dashboards
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    window.location.href = 'login.html';
});
// Add these functions to patient-dashboard.js
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-appointment-btn')) {
        const appointmentId = e.target.dataset.appointmentId;

        if (confirm('Are you sure you want to delete this appointment?')) {
            try {
                const response = await fetch(`/api/appointments/${appointmentId}`, {
                    method: 'DELETE',
                });

                const result = await response.json();
                if (result.success) {
                    alert('Appointment deleted successfully!');
                    loadPatientAppointments(); // Reload appointments list
                } else {
                    alert('Failed to delete appointment.');
                }
            } catch (err) {
                console.error('Error deleting appointment:', err);
            }
        }
    }
});
function openTestModal(appointmentId) {
    const modal = document.getElementById('testModal');
    modal.style.display = 'block';
    loadAppointmentTests(appointmentId);
}

async function loadAppointmentTests(appointmentId) {
    try {
        const response = await fetch(`/api/appointments/${appointmentId}/tests`);
        const tests = await response.json();
        
        const testsContainer = document.getElementById('existingTests');
        testsContainer.innerHTML = tests.map(test => `
            <div class="test-item">
                <span class="test-name">${test.testName}</span>
                <span class="test-result ${getTestResultClass(test.result)}">
                    ${test.result}
                </span>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading tests:', err);
    }
}

function getTestResultClass(result) {
    switch(result) {
        case 'Normal': return 'test-result-normal';
        case 'Abnormal': return 'test-result-abnormal';
        case 'Pending': return 'test-result-pending';
        default: return 'test-result-unknown';
    }
}

// Add this to your existing DOMContentLoaded event listener
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

    // Add click handlers for view tests buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-tests-btn')) {
            openTestModal(e.target.dataset.appointmentId);
        }
    });
});
// Add to patient-dashboard.js
async function loadDepartments() {
    try {
        const response = await fetch('/api/departments');
        const departments = await response.json();
        
        const departmentSelect = document.getElementById('department');
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.department_ID;
            option.textContent = dept.departmentName;
            departmentSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading departments:', err);
    }
}

document.getElementById('department').addEventListener('change', async (e) => {
    const doctorSelect = document.getElementById('doctor');
    doctorSelect.innerHTML = '<option value="">Select Doctor</option>';
    doctorSelect.disabled = true;

    if (e.target.value) {
        try {
            const response = await fetch(`/api/doctors/${e.target.value}`);
            const doctors = await response.json();
            
            doctors.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.doctor_ID;
                option.textContent = doc.doctorName;
                doctorSelect.appendChild(option);
            });
            
            doctorSelect.disabled = false;
        } catch (err) {
            console.error('Error loading doctors:', err);
        }
    }
});

// Set minimum date to today
document.getElementById('appointmentDate').min = new Date().toISOString().split('T')[0];

document.addEventListener('DOMContentLoaded', function() {
    const appointmentModal = document.getElementById('appointmentFormModal');
    const scheduleBtn = document.getElementById('scheduleAppointmentBtn');
    const appointmentSpanClose = appointmentModal.querySelector('.close');

    // Schedule appointment button click handler
    scheduleBtn.onclick = () => {
        appointmentModal.style.display = "block";
    };

    // Close button click handler
    appointmentSpanClose.onclick = () => {
        appointmentModal.style.display = "none";
    };

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target == appointmentModal) {
            appointmentModal.style.display = "none";
        } else if (event.target == profileModal) {
            profileModal.style.display = "none";
        }
    };

    // Form submission handler
    document.getElementById('appointmentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            doctorId: document.getElementById('doctor').value,
            appointmentDate: document.getElementById('appointmentDate').value,
            appointmentDescription: document.getElementById('appointmentDescription').value
        };

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                alert('Appointment scheduled successfully!');
                appointmentModal.style.display = "none"; // Close modal after successful submission
                loadPatientAppointments(); // Reload appointments list
                e.target.reset(); // Reset form
            } else {
                alert('Failed to schedule appointment');
            }
        } catch (err) {
            console.error('Error scheduling appointment:', err);
            alert('Failed to schedule appointment');
        }
    });

    // Initialize date input with minimum date as today
    const dateInput = document.getElementById('appointmentDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;

    // Load departments on page load
    // loadDepartments();
});
// Profile Modal functionality
const profileModal = document.getElementById('profileModal');
const viewProfileBtn = document.getElementById('viewProfileBtn');
const profileSpanClose = profileModal.querySelector('.close');

viewProfileBtn.onclick = async () => {
    try {
        const response = await fetch('/api/patient/profile');
        const profileData = await response.json();
        
        // Format the date
        const dob = new Date(profileData.DOB).toLocaleDateString();
        
        // Update the modal content
        document.getElementById('patientName').textContent = profileData.patientName;
        document.getElementById('age').textContent = profileData.age;
        document.getElementById('bloodGroup').textContent = profileData.bloodGroup;
        document.getElementById('dob').textContent = dob;
        document.getElementById('gender').textContent = profileData.gender;
        document.getElementById('phone').textContent = profileData.phone;
        
        profileModal.style.display = "block";
    } catch (err) {
        console.error('Error loading profile:', err);
        alert('Failed to load profile information');
    }
}

profileSpanClose.onclick = () => {
    profileModal.style.display = "none";
}

window.onclick = (event) => {
    if (event.target == profileModal) {
        profileModal.style.display = "none";
    }
}
