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
import {Directory} from '../../nuxeo/rpc/directory';

class DirectoryEditor extends Handsontable.editors.Select2Editor {
  constructor(instance) {
    super(instance);
  }

  // Let's override prepare and just pass set the select2 options ourselves
  prepare(row, col, prop, td, originalValue, cellProperties) {

    // cellProperties is an instance our our Column
    var widget = cellProperties.widget,
        connection = cellProperties.connection;

    Handsontable.editors.TextEditor.prototype.prepare.apply(this, arguments);

    // See https://github.com/nuxeo/nuxeo-features/blob/master/nuxeo-platform-ui-select2/src/main/java/org/nuxeo/ecm/platform/ui/select2/Select2ActionsBean.java
    this.options = {
      query: function (q) {
        var directory = new Directory(connection); // Directory name is a widget property
        // Set the properties
        Object.assign(directory, widget.properties);
        // Perform the search
        directory.search(q.term)
        //.then((entries) => [ for (e of entries) {id: e.id, text: e.label} ] )
        .then((results) => { q.callback({results: results}); });
      },
      dropdownAutoWidth: true,
      allowClear: true,
      width: 'resolve',
      minimumInputLength: 0,
      formatResult: this.formatter,
      multiple: cellProperties.multiple,
      placeholder: 'Select a value'
    };
  }

  formatter(entry) {
    return entry.displayLabel;
  }
}

export {DirectoryEditor};
