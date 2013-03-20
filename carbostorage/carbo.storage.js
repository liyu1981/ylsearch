/*!
* CarboStorage v1.0
* http://carbogrid.com
*
* Copyright 2012, Halmen Istvan
* Licensed under the MIT license.
*
*/
var Carbo = Carbo || {};

Carbo.storage = function() {

    function Entity(obj) {
        // Constructor
        if (!obj) obj = {};
        var that = this;

        for (var f in obj)
            that[f] = obj[f];
    }

    function Handler(db, n, e, fields) {
        var f = fields,
            ids = (t = get(n + '___id')) ? JSON.parse(t) : [],
            changes = [],
            loadWith = [],
            where = [],
            filter = null,
            order = null,
            single = false,
            indexes = {},
            rels = {};

        // Private functions
        function check(c, v, op) {
            if (op == '<')
                return (c < v);
            if (op == '>')
                return (c > v);
            if (op == '<=')
                return (c <= v);
            if (op == '>=')
                return (c >= v);
            if (op == '!=')
                return (c != v);
            if (op == 'like') {
                re = new RegExp(v, 'i')
                return re.test(c);
            }
            if (op == 'starts') {
                re = new RegExp('^' + v, 'i');
                return re.test(c);
            }
            if (op == 'ends') {
                re = new RegExp(v + '$', 'i')
                return re.test(c);
            }
            if (op == '===') {
                return (c === v);
            }
            return (c == v);
        }

        indexes.__id = ids;
        f.__id = 'int';

        this.name = n;
        this.entity = e;

        /**
        * Fetches data from the localStorage.
        * @returns {Array} Array of objects.
        */
        this.select = function (limit, offset) {
            var items = [],
                ret = [],
                vids = ids,
                vindexes = indexes;

            // Indexed filter
            if (where.length) {
                vids = [];
                vindexes = {};
                for (var ix in indexes) {
                    vindexes[ix] = [];
                }
                for (var i = 0; i < ids.length; i++) {
                    var valid = true;
                    // Filtering on indexes
                    for (var j = 0; j < where.length; j++) {
                        var ff = where[j].field
                        if (indexes[ff]) {
                            var c = indexes[ff][i];
                            var op = where[j].op;
                            var v = where[j].value;

                            if (f[ff] == 'datetime')
                                v = v.getTime();

                            if (!check(c, v, op)) {
                                valid = false;
                                break;
                            }
                        }
                    }
                    if (valid) {
                        vids.push(ids[i]);
                        for (var ix in indexes) {
                            vindexes[ix].push(indexes[ix][i]);
                        }
                    }
                }
            }
            // Get items
            for (var i = 0; i < vids.length; i++) {
                // Construct key based on indexes
                var key = '';
                for (var ix in vindexes) {
                    key += '_' + (vindexes[ix][i] === null || vindexes[ix][i] === undefined ? '' : vindexes[ix][i]);
                }
                // Get and parse object from local storage
                var obj = {};
                try {
                    obj = cs.parse(get(n + key));
                    for (var ix in vindexes) {
                        if (vindexes[ix][i] !== null) {
                            if (f[ix] == 'datetime')
                                obj[ix] = new Date(vindexes[ix][i]);
                            else
                                obj[ix] = vindexes[ix][i];
                        }
                    }
                }
                catch (ex) {
                    console.log(key);
                    //obj = {};
                    continue;
                }
                obj.__key = key;
                // Run where condition on non-indexed fields
                var valid = true;
                for (var j = 0; j < where.length; j++) {
                    var ff = where[j].field
                    if (!indexes[ff]) {
                        var c = obj[ff];
                        var op = where[j].op;
                        var v = where[j].value;

                        if (!check(c, v, op)) {
                            valid = false;
                            break;
                        }
                    }
                }
                if (!valid) {
                    continue;
                }
                // Run filter function
                if (filter !== null && !filter(obj)) {
                    continue;
                }
                // Fetch relationships
                for (var j = 0; j < loadWith.length; j++) {
                    var ft = loadWith[j];
                    var rel = rels[ft];
                    if (rel) {
                        if (rel.type == 'hasMany') {
                            var res = db[ft].where(rel.key, obj.__id, '===').select();
                            obj[ft] = res;
                        }
                        else {
                            var res = db[ft].where('__id', obj[rel.key], '===').select();
                            obj[db[ft].entity] = res[0] === undefined ? {} : res[0];
                        }
                    }

                }
                items.push(obj);
            }
            // Order
            if (order !== null && !single) {
                items.sort(function (a, b) {
                    for (var n in order) {
                        if (a[n] == b[n]) continue;
                        return (order[n] == 'desc') ? (b[n] < a[n] ? -1 : 1) : (b[n] > a[n] ? -1 : 1);
                    }
                    return 0;
                });
            }
            // Reset
            filter = null;
            order = null;
            loadWith = [];
            where = [];
            if (limit !== undefined) {
                offset = offset === undefined || offset < 0 ? 0 : offset
                var l = (offset + limit) > items.length ? items.length : (offset + limit);
                for (var i = offset; i < l; i++) {
                    ret.push(items[i]);
                }
            }
            else
                ret = items;
            return ret;
        }

        this.loadWith = function(table) {
            loadWith.push(table);
            return this;
        }

        /**
        * Sets a filter.
        * @param {String|Function} func If a function is passed, it will be called
        * for every element in the result set, when filtering.
        * Otherwise a string with a field name must be passed. If the field has index on it,
        * filtering will occur on the index arrays, before fetching the data from the localStorage,
        * if it has no index, filtering will occur after fetching the data from the localStorage.
        * @param {String|Number|Boolean} [v] Compare value, optional. Must be passed, if first parameter is not a function.
        * @param {String} [op] Comparision operator, optional. Default is '='.
        * @returns {Handler} Returns self reference for chaining.
        */
        this.where = function (func, v, op) {
            if (typeof func == 'string') {
                //if (indexes[func])
                    where.push({
                        field: func,
                        op: op,
                        value: v
                    });
            }
            else {
                filter = func;
            }
            return this;
        }

        /**
        * Sets an ascending order.
        * @param {String} ord Name of the field to order.
        * @returns {Handler} Returns self reference for chaining.
        */
        this.orderBy = function(ord) {
            if (order == null) order = {};
            order[ord] = 'asc';
            return this;
        }

        /**
        * Sets descending order.
        * @param {String} ord Name of the field to order.
        * @returns {Handler} Returns self reference for chaining.
        */
        this.orderByDesc = function(ord) {
            if (order == null) order = {};
            order[ord] = 'desc';
            return this;
        }

        this.add = function (obj) {
            // Create new id
            obj.__id = ids.length ? (ids[ids.length - 1] + 1) : 0;
            // Set indexes
            for (var ix in indexes) {
                if (f[ix] == 'datetime')
                    indexes[ix].push(obj[ix] ? obj[ix].getTime() : null);
                else
                    indexes[ix].push(obj[ix]);
            }
            changes.push(obj);
            cs.submit();
        }

        this.remove = function (obj) {
            // Delete id
            //var i = ids.indexOf(obj.__id);
            var i = cs.indexOf(ids, obj.__id);
            if (i >= 0) {
                // Delete indexes
                for (var ix in indexes) {
                    indexes[ix].splice(i, 1);
                }
                obj.__deleted = 1;
                changes.push(obj);
            }
            cs.submit();
        }

        this.update = function (obj) {
            //var i = ids.indexOf(obj.__id);
            var i = cs.indexOf(ids, obj.__id);
            if (i >= 0) {
                // Update indexes
                for (var ix in indexes) {
                    if (f[ix] == 'datetime')
                        indexes[ix][i] = obj[ix] ? obj[ix].getTime() : null;
                    else
                        indexes[ix][i] = obj[ix];
                }
                changes.push(obj);
            }
            cs.submit();
        }

        this.getIDs = function() {
            return ids;
        }

        this.getIndexes = function() {
            return indexes;
        }

        this.getChanges = function() {
            return changes;
        }

        this.emptyChanges = function() {
            changes = [];
        }

        this.getFields = function() {
            return f;
        }

        this.hasMany = function(name, fkey) {
            rels[name] = {
                key: fkey,
                type: 'hasMany'
            };
            db[name].addIndex(fkey);
        }

        this.hasOne = function(name, fkey) {
            rels[name] = {
                key: fkey,
                type: 'hasOne'
            };
            this.addIndex(fkey);
        }

        this.addIndex = function(key) {
            indexes[key] = (t = get(n + '_' + key)) ? JSON.parse(t) : [];
        }

    }

    // Private members
    var ls = window.localStorage;
    var entities = {};

    // Private functions
    function onChange(obj) {
        changes.push(obj);
        console.log(obj);
    }

    function set(key, value) {
        ls.setItem(key, value);
    }

    function get(key) {
        return ls.getItem(key);
    }

    function remove(key) {
        ls.removeItem(key);
    }

    // Public functions
    var cs = {
        define: function(name, entity,  fields) {
            window[entity] = Entity;
            this[name] = new Handler(this, name, entity, fields);
            entities[name] = 1;
        },
        submit: function () {
            for (var n in entities) {
                var items = cs[n].getChanges();
                var indexes = cs[n].getIndexes();
                var fields = cs[n].getFields();
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    if (item.__deleted) {
                        // Delete
                        remove(n + item.__key);
                    }
                    else {
                        // Insert / Update
                        var obj = {};
                        // Save only valid fields
                        //for (var f in fields) {
                        for (var f in item) {
                            if (item[f] !== undefined && item[f] !== null) obj[f] = item[f];
                        }
                        // Generate new index key
                        var key = '';
                        for (var ix in indexes) {
                            if (fields[ix] == 'datetime') {
                                item[ix] = item[ix] ? item[ix].getTime() : null;
                            }
                            key += '_' + (item[ix] === null || item[ix] === undefined ? '' : item[ix]);
                            delete obj[ix];
                        }
                        if (key !== item.__key) {
                            // Remove old entry
                            remove(n + item.__key);
                        }
                        delete obj.__key;
                        set(n + key, JSON.stringify(obj));
                        obj.__key = key;
                        item.__key = key;
                    }
                }
                // Save indexes
                for (var ix in indexes) {
                    if (indexes[ix].length)
                        set(n + '_' + ix, JSON.stringify(indexes[ix]));
                    else
                        remove(n + '_' + ix);
                }
                // Clear changeset
                cs[n].emptyChanges();
            }
        },
        // Date reviver for JSON strings
        str2date: function (str) {
            var reISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/;
            var reMsAjax = /^\/Date\((d|-|.*)\)\/$/;
            var a;
            a = reISO.exec(str);
            if (a) {
                return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]));
            }
            a = reMsAjax.exec(str);
            if (a) {
                return new Date(parseInt(a[1].substr(0)));
            }
            return str;
        },
        // Extended JSON parse
        parse: function (str) {
            return JSON.parse(str, function (key, value) {
                if (typeof value === 'string') {
                    return cs.str2date(value);
                }
                return value;
            });
        },
        indexOf: function (t, s, n) {
            var len = t.length >>> 0;
            if (len === 0) {
                return -1;
            }
            if (n === undefined) {
                n = 0;
            }
            if (n >= len) {
                return -1;
            }
            var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
            for (; k < len; k++) {
                if (k in t && t[k] === s) {
                    return k;
                }
            }
            return -1;
        }
    }

    return cs;
}();
