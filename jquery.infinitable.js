(function($) {
  var namespace = 'infiniTable';

  $.fn.infiniTable = function(method) {
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
    } else if (typeof method === 'object' || ! method) {
      return methods.init.apply(this, arguments);
    } else {
      $.error('Method ' +  method + ' does not exist on jQuery.' + namespace);
    }    
  }

  var methods = {
    init: function(settings) {
      return this.each(function() {
        var $this = $(this), data = $this.data(namespace);

        if(data)
          return;

        var spacer = $('<tr/>'), bspacer = $('<tr/>');
        $this.append(spacer);
        $this.append(bspacer);

        var model = new Model(
          settings.model,
          settings.sortColumn, settings.sortAscending
        );

        settings.render = settings.render || function defaultRender(data) {
          var cell = $('<tr>');

          for(var prop in data) {
            if(!data.hasOwnProperty(prop) || prop === '_index')
              continue;

            cell.append($('<td>').html(data[prop]));
          }

          return cell;
        }

        data = {
          settings: settings,
          model: model,
          cache: {},
          cacheItv: new Interval(),
          bufferSize: 10,
          spacer: spacer,
          bspacer: bspacer
        };

        $this.data(namespace, data);

        var self = this;
        var refreshHandler = function() {
          updateVisible.call(self, data);
        };

        $(window).bind('resize', refreshHandler);
        $(window).scroll(refreshHandler);

        forceRefresh.call(this, data);
      });
    },

    destroy: function() {
      return this.each(function() {
        var $this = $(this), data = $this.data(namespace);

        if(!data)
          return;

        resetCache(data);
        data.spacer.detach();
        data.bspacer.detach();
        $this.removeData(namespace);
      });
    },

    sort: function(options) {
      return this.each(function() {
        var $this = $(this), data = $this.data(namespace);

        if(!data)
          return;

        data.model.sort(options);
        forceRefresh.call(this, data);
      });
    },

    filter: function(column, query) {
      return this.each(function() {
        var $this = $(this), data = $this.data(namespace);

        if(!data)
          return;

        data.model.filter(column, query);
        forceRefresh.call(this, data);
      });
    },

    get: function(id) {
      var $this = this.first(), data = $this.data(namespace);

      if(!data)
        return null;

      return data.model.getById(id);
    },

    set: function(elem, forceRefresh) {
      return this.each(function() {
        var $this = $(this), data = $this.data(namespace);

        if(!data)
          return;

        var id = elem.id, oldElem = data.model.getById(id);

        if(!oldElem) {
          var i = data.model.insert(elem);
          // FIXME: also recompute view
          /*
          // shift cells to make room for the new cell
          if(i && forceRefresh !== false) {
            $this.height(getTableHeight(data));
            insertCellAtIndex.call(this, data, i);
          }
          */
        } else {
          var i = data.model.update(oldElem, elem);
          var cell = data.cache[i];

          if(cell && forceRefresh !== false) {
            var newCell = makeCell(data, i);
            cell.trigger('detach');
            cell.replaceWith(newCell);
            data.cache[i] = newCell;
          }
        }
      });
    },

    refresh: function() {
      return this.each(function() {
        var $this = $(this), data = $this.data(namespace);

        if(!data)
          return;

        forceRefresh.call(this, data);
      });
    },
  }

  function forceRefresh(data) {
    resetCache(data);
    $(this).height(data.model.length*data.settings.cellHeight);
    updateVisible.call(this, data);
  }

  function getVisibles(data) {
    var offset = $(window).scrollTop();
    var range = $(window).height();

    // strictly visible bounds
    var visibles = new Interval(
        Math.floor(offset/data.settings.cellHeight) - 1,
        Math.floor((offset + range - 1)/data.settings.cellHeight));

    // expand a bit to avoid flickers
    visibles.expand(data.bufferSize);

    var viewport = new Interval(0, data.model.length);
    visibles.clip(viewport);

    return visibles;
  }

  function detachCell(data, i) {
    var cell = data.cache[i];

    if(cell) {
      cell.trigger('detach');
      cell.detach();
      delete data.cache[i];
    }
  }

  function resetCache(data) {
    for(var i in data.cache) {
      if(!data.cache.hasOwnProperty(i))
        continue;

      detachCell(data, i);
    }
  }

  function makeCell(data, i) {
    var cellModel = data.model.get(i);
    var cell = data.settings.render(cellModel, i);
    data.cache[i] = cell;

    return cell;
  }

  function updateSpacers(data, visibles) {
    var cellHeight = data.settings.cellHeight,
        modelSize = data.model.length;

    data.spacer.height(visibles.min*cellHeight);
    data.bspacer.height((modelSize - visibles.max)*cellHeight);
  }

  function updateVisible(data) {
    var $this = $(this),
        visibles = getVisibles(data),
        anchor = data.spacer;

    /*
     * Add missing cells
     * Cells have to be inserted in order, so we keep track of
     * the anchor: the node after which the cell needs to appear.
     */
    visibles.each(function(i) {
      var cell = data.cache[i];

      if(!cell) {
        cell = makeCell(data, i);
        anchor.after(cell);
      }

      anchor = cell;
    });

    // remove invisible cells
    data.cacheItv.each(function(i) {
      if(!visibles.contains(i)) {
        detachCell(data, i);
      }
    });

    updateSpacers(data, visibles);
    data.cacheItv = visibles;
  }

  var Interval = function(min, max) {
    this.min = min || 0;
    this.max = max || 0;
  };

  Interval.prototype.clip = function(itv) {
    if(this.max <= itv.min || this.min >= itv.max) {
      this.min = this.max = 0;
      return;
    }

    this.min = Math.max(this.min, itv.min);
    this.max = Math.min(this.max, itv.max);
  };

  Interval.prototype.contains = function(i) {
    return i >= this.min && i < this.max;
  };

  Interval.prototype.expand = function(i) {
    this.min -= i;
    this.max += i;
  };

  Interval.prototype.each = function(fun) {
    for(var i = this.min; i < this.max; i += 1) {
      fun(i);
    } 
  };

  function makeComparator(options) {
    return function(a, b) {
      this.column = options.column;
      this.ascending = options.ascending !== false;

      var ca = a[this.column], cb = b[this.column];
      var asc = this.ascending === false ? -1 : 1;

      if(ca === cb)
        return 0;

      if(ca > cb)
        return asc;

      if(ca < cb)
        return -asc;

      return 0;
    };
  };

  function makeFilter(column, rawQuery) {
    var query = rawQuery ? rawQuery.toLowerCase() : null;

    return function(a) {
      if(!column || !query)
        return true;

      var ca = a[column];

      return ca.toLowerCase().indexOf(query) >= 0;
    };
  };

  var Model = function(elements, sortColumn, sortAscending) {
    this.comparator = makeComparator({
      column: sortColumn || '_index',
      ascending: sortAscending
    });
    this.filterPredicate = makeFilter(null, null);
    this.elements = {};
    this.transform = sorted([], this.comparator);
    this.length = 0;
    
    if(typeof(elements) === 'function')
      elements = elements();

    for(var i = 0, l = elements.length; i < l; i++) {
      var elem = elements[i];
      elem._index = i; // mark the original order to be able to restore it later
      this.insert(elem);
    }
  };

  Model.prototype.get = function(i) {
    return this.transform.get(i);
  };

  Model.prototype.getById = function(id) {
    return this.elements[id];
  };

  Model.prototype.insert = function(elem) {
    var id = elem.id;

    // don't insert duplicates
    if(!!this.elements[id])
      return;

    this.elements[id] = elem;

    if(this.filterPredicate(elem)) {
      this.transform.push(elem);
      this.length = this.transform.length;
      return this.transform.indexOf(elem);
    }

    return null;
  };

  Model.prototype.update = function(oldElem, elem) {
    var id = elem.id, i = this.transform.indexOf(oldElem);

    if(i >= 0)
      this.transform.set(i, elem);

    this.elements[id] = elem;

    return i;
  };

  Model.prototype.sort = function(options) {
    this.comparator = makeComparator(options);
    this.transform = this.transform.sort(this.comparator);
  };

  Model.prototype.filter = function(column, query) {
    this.filterPredicate = makeFilter(column, query);
    this.transform = sorted([], this.comparator);

    for(var i in this.elements) {
      if(!this.elements.hasOwnProperty(i))
        continue;

      var elem = this.elements[i];

      if(this.filterPredicate(elem))
        this.transform.push(elem);
    }

    this.length = this.transform.length;
  };

  // Small class to maintain a sorted collection
  // Unfortunately, I can't find its author
  var sorted = function (xs, cmp) {
    if (typeof xs === 'function') {
      cmp = arguments[0];
      xs = arguments[1];
    }
    if (!xs) xs = [];

    if (isSorted(xs, cmp)) {
      return fromSorted(xs, cmp);
    }
    else {
      var s = fromSorted([], cmp);
      for (var i = 0; i < xs.length; i++) s.push(xs[i]);
      return s;
    }

   function isSorted(xs, cmp) {
      if (xs instanceof Sorted) return true;
      if (xs.length <= 1) return true;

      var isSorted = true;

      if (cmp) {
        for (var i = 1; i < xs.length; i++) {
          var c = cmp(xs[i-1], xs[i]);
          if (c > 0) {
            isSorted = false;
            break;
          }
          else if (c < 0) {}
          else if (c === 0) {}
          else {
            isSorted = false;
            break;
          }
        }
      }
      else {
        for (var i = 1; i < xs.length; i++) {
          var x = xs[i-1], y = xs[i];
          if (x > y) {
            isSorted = false;
            break;
          }
          else if (x < y) {}
          else if (x === y) {}
          else {
            isSorted = false;
            break;
          }
        }
      }

      return isSorted;
    };

    function fromSorted(xs, cmp) {
      return new Sorted(xs, cmp);
    };
  };

  var Sorted = function (xs, cmp) {
    this.elements = xs;
    this.length = xs.length;

    this.compare = cmp || function (a, b) {
      if (a == b) return 0
      else if (a > b) return 1
      else if (a < b) return -1
      else throw new RangeError('Unstable comparison: ' + a + ' cmp ' + b)
    };
  };

  Sorted.prototype.push = Sorted.prototype.unshift = function (x) {
    if (arguments.length > 1) {
      for (var i = 0; i < arguments.length; i++) {
        this.push(arguments[i]);
      }
    }
    else {
      var i = this.findIndex(x);
      this.elements.splice(i, 0, x);
    }

    this.length = this.elements.length;
    return this.elements.length;
  };

  Sorted.prototype.splice = function (ix, len) {
    var res = this.elements.splice(ix, len);

    for (var i = 2; i < arguments.length; i++) {
      this.push(arguments[i]);
    }

    this.length = this.elements.length;
    return res;
  };

  Sorted.prototype.findIndex = function (x, start, end) {
    var elems = this.elements;
    if (start === undefined) start = 0;
    if (end === undefined) end = elems.length;

    for (var i = start, j = end; ;) {
      var k = Math.floor((i + j) / 2);
      if (k > end) break;
      if (i === j) break;

      var cmp = this.compare(x, elems[k]);
      if (cmp === 0) break;
      else if (cmp < 0) j = k;
      else if (cmp > 0) i = k + 1;
      else throw new RangeError(
          'Unstable comparison result for compare('
            + x + ', ' + elems[k] + ') : ' + cmp + ')'
          );
    }

    return k;
  };

  Sorted.prototype.indexOf = function (x) {
    var i = this.findIndex(x);
    return this.elements[i] === x ? i : -1;
  };

  Sorted.prototype.inspect = function () {
    return '<Sorted [' + this.elements.join(',') + ']>'
  };

  Sorted.prototype.toArray = function () {
    return this.elements.slice()
  };

  Sorted.prototype.sort = function (cmp) {
    if (!cmp || this.compare === cmp) {
      return this.slice();
    }
    else {
      return sorted(this.elements, cmp);
    }
  };

  Sorted.prototype.concat = function () {
    var xs = this.slice();
    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      if (Array.isArray(arg)) {
        xs.push.apply(xs, arg);
      }
      else if (arg instanceof Sorted) {
        xs.insert(arg);
      }
      else {
        xs.push(arg);
      }
    }
    return xs;
  };

  Sorted.prototype.insert = function (xs) {
    if (xs.length === 0) return this;

    if (!(xs instanceof Sorted)) {
      xs = sorted(Array.isArray(xs) ? xs : [ xs ], this.compare);
    }
    if (!sorted.isSorted(xs.toArray())) throw new Error('not sorted: ' + xs.join(','));

    var x = xs.get(0);
    var start = this.findIndex(x);

    if (xs.length > 1) {
      var y = xs.get(xs.length - 1);
      var end = Math.min(this.length, this.findIndex(y) + 1);
    }
    else {
      var end = start + 1;
    }

    for (var i = 0; i < xs.length; i++) {
      var x = xs.get(i);
      var ix = this.findIndex(x, start, end);
      this.elements.splice(ix, 0, x);
      end ++;
    }

    this.length = this.elements.length;

    return this;
  };

  Sorted.prototype.get = function (i) {
    return this.elements[i];
  };

  Sorted.prototype.set = function (i, x) {
    this.elements.splice(i, 1);
    this.push(x);
    return this;
  };

  Sorted.prototype.slice = function () {
    return sorted.fromSorted(
        this.elements.slice.apply(this.elements, arguments),
        this.compare
        );
  };

  Sorted.prototype.map = function () {
    return sorted(
        this.elements.map.apply(this.elements, arguments),
        this.compare
        );
  };

  Sorted.prototype.filter = function () {
    return sorted.fromSorted(
        this.elements.filter.apply(this.elements, arguments),
        this.compare
        );
  };

  [ 'forEach', 'reduce', 'reduceRight', 'every', 'some', 'join' ]
    .forEach(function (name) {
      Sorted.prototype[name] = function () {
        return this.elements[name].apply(this.elements, arguments);
      };
    })
  ;

  Sorted.prototype.shift = function () {
    var x = this.elements.shift();
    this.length = this.elements.length;
    return x;
  };

  Sorted.prototype.pop = function () {
    var x = this.elements.pop();
    this.length = this.elements.length;
    return x;
  };
})(jQuery);
