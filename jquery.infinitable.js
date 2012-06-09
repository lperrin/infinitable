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
      this.column = options.column || 'id';
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
      column: sortColumn,
      ascending: sortAscending
    });
    this.filterPredicate = makeFilter(null, null);
    this.elements = {};
    this.transform = sorted([], this.comparator);
    this.length = 0;

    for(var i = 0, l = elements.length; i < l; i++) {
      var elem = elements[i];
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
})(jQuery);
