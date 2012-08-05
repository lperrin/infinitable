infinitable
===========

jQuery plugin to display very long tables in a browser with an MVC twist.

The plugin inserts only visible rows in the DOM, in a similar fashion to iOS.
It uses 2 spacers that are inserted at the beginning and end of the table to maintain
its global size even though most of the rows are missing. It does not use absolute
positioning to avoid visual glitches.

The model can be updated, sorted and filtered dynamically.

Usage
-----

To activate the plugin, you need to pass several options:

```javascript
$('#list').infiniTable({
  cellHeight: 50,
  model: getModel(),
  render: renderRow // optional
});
```

`model` is either an array of object or a function that returns one:

```javascript
var model = [
  {
    id: 1,
    name: 'Albert Einstein',
    birth: '1879-03-14'
  },
  {
    id: 2,
    name: 'Isaac Newton',
    birth: '1643-01-04'
  },
  {
    id: 3,
    name: 'Johannes Kepler',
    birth: '1571-12-27'
  }
];
```

You can optionally provide a custom `render` function, which generates a DOM node with the model. For example:

```javascript
function renderRow(data) {
  return $('<tr>')
    .append($('<td>').html(data.id))
    .append($('<td>').html(data.name))
    .append($('<td>').html(data.birth));
}
```

You can sort the table at any time:

```javascript
$('#list').infiniTable('sort', {
  column: $(this).html().toLowerCase(),
  ascending: true
});
```

You can also show only rows that match a predicate:

```javascript
$('#list').infiniTable('filter', 'string', this.value);
```
