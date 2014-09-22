/*
 * (C) Copyright 2014 Nuxeo SA (http://nuxeo.com/) and contributors.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * Contributors:
 *     Nelson Silva <nelson.silva@inevo.pt>
 */
import {Column} from './column';
import {Layout} from '../nuxeo/layout';
import {Directory} from '../nuxeo/rpc/directory';
import {Query} from '../nuxeo/rpc/query';

/**
 * DataGrid backed by Hansontable
 */
class DataGrid {

  constructor(container, connection, layout = 'datagrid_listing', columns = null) {
    this.container = container;
    this.connection = connection;

    this.options = {
      rowHeaders: true,
      manualColumnResize: true,
      startRows: 0,
      currentRowClassName: 'currentRow',
      currentColClassName: 'currentCol',
      contextMenu: ['undo', 'redo', 'sep1', 'sep2', 'sep3'],
      afterChange: this.onChange.bind(this),
      search: true,
      cells: this.createCell.bind(this)
    };

    this.query = new Query(connection);
    this.query.enrichers = ['permissions'];

    new Layout(connection, layout).fetch().then((layout) => {
      // Check which columns to display
      var cols = (!columns) ? layout.columns :  layout.columns.filter((c) => columns.indexOf(c.name) !== -1);
      this.columns = cols
        .map((c) => new Column(connection, c, layout.widgets[c.widgets[0].name], this.dirtyRenderer.bind(this)))
        // Remove columns without a field
        .filter((c) => c.field);
    });

    this._dirty = {};
    this.container.handsontable(this.options);
    this.ht = this.container.data('handsontable');
  }

  get data() { return this._data; }
  set data(d) {
    this._data = d;
    this.ht.loadData(d);
  }

  // Returns source data
  getDataAtRow(row) {
    return (this.ht) ? this.ht.getSourceDataAtRow(row) : null;
  }

  get columns() { return this._columns; }
  set columns(columns) {
    this._columns = columns;
    this._update();
  }

  createCell(row, col, prop) {
    var cell = {};
    var doc = this.getDataAtRow(row);
    var permissions = doc && doc.contextParameters && doc.contextParameters.permissions;
    if (permissions && (permissions.indexOf('Write') === -1)) {
      cell.readOnly = true;
    }
    return cell;
  }

  update() {
    // Fetch first page to get the number of pages
    return this.query.run().then((result) => {
      // Add the first page results as a resolved promise
      var promises = [Promise.resolve(result.entries)];

      // TODO(nfgs) - handle more than MAX_RESULTS
      // Must sequentially check for next page in this case

      // Add all the other page requests to the promise list
      for (var i = 1; i < result.numberOfPages; i++) {
        this.query.page = i;
        promises.push(this.query.run().then((result) => result.entries));
      }
      // Wait for all the promisses
      return Promise.all(promises);
    })
      // Merge all the entries
      .then((entries) => entries.reduce((data, page) => data.concat(page)))
      // Update the table data
      .then((data) => this.data = data);
  }

  save() {
    return Promise.all(
      Object.keys(this._dirty).map((uid) => {
        return new Promise((resolve, reject) => {
          // TODO(nfgs) - Move request execution to the connection

          this.connection.request('/id/' + uid)
            .put(
            {data: this._dirty[uid]},
            (error) => {
              if (error) {
                reject(Error(error));
              }
              delete this._dirty[uid];
              resolve(uid);
            });
        });
      })
    ).then(() => this.ht.render());
  }

  onChange(change, source) {
    if (source === 'loadData') {
      this._dirty = {};
      return;
    }
    if (change !== null) {
      for (var i = 0; i < change.length; i++) {
        var [idx, field, oldV, newV] = change[i];
        if (oldV === newV) {
          continue;
        }
        var uid = this.data[idx].uid;
        var doc = this._dirty[uid] = this._dirty[uid] || {};

        // Split csv values into array
        if (Array.isArray(oldV)) {
          newV = newV.split(',');
        }

        assign(doc, field, newV);
      }
      if (this.autosave) {
        this.save();
      }
      this.ht.render();
    }
  }

  dirtyRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    var doc = this.getDataAtRow(row);
    if (doc && this._dirty[doc.uid] && hasProp(this._dirty[doc.uid], prop)) {
      $(td).css({
        background: '#e2f1ff'
      });
    }
  }

  destroy() {
    this.ht.destroy();
  }

  _update() {
    var options = $.extend({}, this.options);
    options.colHeaders = this.columns.map((c) => c.header);
    options.columns = this.columns;
    this.ht.updateSettings(options);
  }
}

// Renderers
var ReadOnlyRenderer = function (instance, td, row, col, prop, value, cellProperties) {
  Handsontable.renderers.TextRenderer.apply(this, arguments);
  td.style.color = 'green';
  td.style.background = '#CEC';
};
Handsontable.renderers.registerRenderer('readOnly', ReadOnlyRenderer);

// Property Utils

// http://stackoverflow.com/questions/13719593/javascript-how-to-set-object-property-given-its-string-name
function assign(obj, prop, value) {
  if (typeof prop === 'string') {
    prop = prop.split('.');
  }

  if (prop.length > 1) {
    var e = prop.shift();
    assign(obj[e] = Object.prototype.toString.call(obj[e]) === '[object Object]'? obj[e] : {},
      prop,
      value);
  } else {
    obj[prop[0]] = value;
  }
}

function hasProp(obj, prop) {
  if (typeof prop === 'string') {
    prop = prop.split('.');
  }

  if (prop.length > 1) {
    var e = prop.shift();
    return hasProp(obj[e] = Object.prototype.toString.call(obj[e]) === '[object Object]'? obj[e] : {},
      prop);
  } else {
    return obj.hasOwnProperty(prop[0]);
  }
}

export {DataGrid};
