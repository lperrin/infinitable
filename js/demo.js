$(document).ready(function() {
  $('#list').infiniTable({
    cellHeight: 50,
    model: makeModel(),
    sortColumn: 'id'
  });

  $('#list').on('click', 'th', function() {
    $('#list').infiniTable('sort', {
      column: $(this).html().toLowerCase(),
      ascending: true
    });
  });

  $('#filter').keyup(function() {
    $('#list').infiniTable('filter', 'string', this.value);
  });
});

function renderCell(data) {
  return $('<tr>')
    .append($('<td>').html(data.id))
    .append($('<td>').html(data.value))
    .append($('<td>').html(data.string));
}

function makeModel() {
  var model = [];

  for(var i = 0; i < 10000; i++) {
    model.push({
      id: i,
      value: Math.random(),
      string: randomString(20)
    });
  }

  return model;
}

function randomString(length) {
  var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');

  if (! length) {
    length = Math.floor(Math.random() * chars.length);
  }

  var str = '';
  for (var i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}

