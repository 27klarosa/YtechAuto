console.log('Form validation script loaded.');

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('ticket-form');
  console.log('Form:', form);

  form.addEventListener('submit', function (e) {
    console.log('Submit event triggered');
    let isValid = true;


    // //ro Section
    // const roNumber = document.getElementById('ro-number');
    // if (/* logic*/true) {
    //   isValid = false;
    //   alert('Please enter a valid RO Number.');
    // }

    // const roDate = document.getElementById('ro-date');
    // if (/* logic*/true) {
    //   isValid = false;
    //   alert('Please enter a valid RO Number.');
    // }

    // const technician = document.getElementById('technician');
    // if (/* logic*/true) {
    //   isValid = false;
    //   alert('Please enter a valid RO Number.');
    // }


    // //time Section
    // const timeIn = document.getElementById('time-in');
    // if (/* logic*/true) {
    //   isValid = false;
    //   alert('Please enter a valid RO Number.');
    // }

    // const timeOut = document.getElementById('time-out');
    // if (/* logic*/true) {
    //     isValid = false;
    //     alert('Please enter a valid RO Number.');
    //   }



    //vehicle inspection Section

    const year = document.getElementById('year');
    if (!/^\d{4}$/.test(year.value.trim())) {
      isValid = false;
      alert('Please enter a valid 4-digit Year.');
    }





  })
})





document.getElementById('repForm').addEventListener('submit', function () {
  event.preventDefault();
  let roNum = document.getElementById('roNum').value;
  let technician = document.getElementById('technician').value;
  let custName = document.getElementById('custName').value;
  let vehicleymm = document.getElementById('vehicleymm').value;
  let vin = document.getElementById('vin').value;
  let licensePlate = document.getElementById('licensePlate').value;
  let mileIn = document.getElementById('mileIn').value;
  let mileOut = document.getElementById('mileOut').value;
  let concern = document.getElementById('concern').value;
  let diagnosis = document.getElementById('diagnosis').value;
  let tax = document.getElementById('tax').value;
  let totEstimate = document.getElementById('totEstimate').value;
  let custAddress = document.getElementById('custAddress').value;
  let custPhone = document.getElementById('custPhone').value;
  let custEmail = document.getElementById('custEmail').value;
  // Validation logic
  let errors = [];



  technician = technician.trim();
  custName = custName.trim();
  vehicleymm = vehicleymm.trim();
  mileIn = parseInt(mileIn);
  mileOut = parseInt(mileOut);
  vin = vin.trim();
  licensePlate = licensePlate.trim();
  tax = parseFloat(tax);
  totEstimate = parseFloat(totEstimate);
  custAddress = custAddress.trim();
  roNum = Number(roNum.trim());
  if (isNaN(roNum)) {
    errors.push('Repair Order number must be a valid number.');
  }

  if (licensePlate.length > 10) {
    errors.push('License plate Number too long. Max 10 characters.');
  }
  if (vin.length > 17) {
    errors.push('VIN too long. Max 17 characters.');
  }
  if (custName === '') {
    errors.push('Customer name cannot be empty.');
  }
  if (vehicleymm === '') {
    errors.push('Vehicle Year/Make/Model cannot be empty.');
  }
  if (isNaN(mileIn) || isNaN(mileOut)) {
    errors.push('Mileage In and Out must be valid numbers.');
  }
  if (mileIn < 0 || mileOut < 0) {
    errors.push('Mileage cannot be negative.');
  }
  if (mileOut < mileIn) {
    errors.push('Mileage Out cannot be less than Mileage In.');
  }
  if (concern === '') {
    errors.push('Customer concern cannot be empty.Put all good or no concern if no concern.');
  }
  if (diagnosis === '') {
    errors.push('Diagnosis cannot be empty. Put N/A if no diagnosis.');
  }
  if (isNaN(tax)) {
    errors.push('Tax must be a valid number.');
  }
  if (tax < 0) {
    errors.push('Tax cannot be negative.');
  }
  if (isNaN(totEstimate)) {
    errors.push('Total Estimate must be a valid number.');
  }
  if (totEstimate < 0) {
    errors.push('Total Estimate cannot be negative.');
  }
  if (custEmail !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
    errors.push('Email must be in a valid format.');
  }
  if (technician === '') {
    errors.push('Technician name cannot be empty.');
  }
  if (technician.length < 2) {
    errors.push('Technician name must be at least 2 characters.');
  }
  if (!/^[a-zA-Z\s\-\.]+$/.test(technician)) {
    errors.push('Technician name can only contain letters, spaces, hyphens, and periods.');
  }
  if (custPhone !== '' && !/^(\d{10}|\d{3}-\d{3}-\d{4})$/.test(custPhone)) {
    errors.push('Phone number must be 10 digits or XXX-XXX-XXXX format.');
  }
  if (custAddress === '') {
    errors.push('Customer address cannot be empty.');
  }
  if (custAddress.length < 5) {
    errors.push('Customer address must be at least 5 characters.');
  }
  if (custAddress.length > 100) {
    errors.push('Customer address cannot exceed 100 characters.');
  }

  if (errors.length > 0) {
    console.log('Errors found:', errors);
    alert(errors.join('\n'));
  } else {
    console.log('Form is valid! Submitting to backend...');
    document.getElementById('repForm').submit();
  }
});