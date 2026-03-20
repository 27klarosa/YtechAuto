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