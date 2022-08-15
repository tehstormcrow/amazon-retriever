inputChangeHandler = element => {
  element.style.border = "2px red solid";
};

$(document).ready(function() {
  // -----------------------------------------------------------------------
  $.each($('.navbar').find('li'), function() {
      $(this).toggleClass('active', 
          window.location.pathname.indexOf($(this).find('a').attr('href')) > -1);
  }); 
  // -----------------------------------------------------------------------

  $('#table-1').clone(true).appendTo('#faux-table-1').addClass('clone');
  $('#table-2').clone(true).appendTo('#faux-table-2').addClass('clone');
});