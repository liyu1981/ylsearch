'use strict';

var ylsearch = ylsearch || {};

ylsearch.localSearchHelper = function() {
  var LocalSearchHelper = {
    // Variables
    targetDiv: null,
    db: Carbo.storage,
    i18n: {'JS_BusyIndexing': 'Busy in indexing...',
           'JS_TypeToSearch': 'Type to search...'},

    // public functions
    buildDb: function(cells, fields) {
      window.localStorage.clear();

      if (cells.size() > 0 && fields.size() > 0) {
        // create the scheme first
        var itemScheme = {lsid: 'string', fulltext: 'string'};
        for (var i=0; i<fields.size(); ++i) {
          itemScheme[fields[i]] = 'string';
        }
        this.db.define('ylsearch', 'item', itemScheme);

        // now iterate & insert data to local storage
        var ourDb = this.db;
        cells.each(function(index, cell) {
          var c = $(cell);
          if (c.hasClass('ylsearch-ignore'))
            return;
          var item = {};
          var fulltext = '';
          item.lsid = c.attr('ylsearch_id');
          fields.each(function(index, field) {
            item[field] = $('#' + field, c).text();
            fulltext = fulltext + item[field];
          });
          item.fulltext = fulltext;
          ourDb.ylsearch.add(item);
        });
      }
    },

    completeUI: function() {
      var targetSpan = $('.ylsearch-lsbox');
      targetSpan.html('');
      targetSpan.addClass('input-append');
      targetSpan.html(
        '<input class="span4 search" type="text" ' +
        'placeholder="' + this.i18n['JS_BusyIndexing'] + '" disabled></input>' +
        '<button class="btn" type="button" disabled>' +
        '<i class="icon-search"></i>' +
        '</button>');
    },

    init: function(targetDiv, fields) {
      this.targetDiv = targetDiv;
      this.completeUI();

      var cells = $('.cell', this.targetDiv);
      cells.each(function(index, element) {
        var t = $(element);
        if (t.hasClass('ylsearch-ignore'))
          return;
        t.attr('ylsearch_id', index);
      });

      this.buildDb(cells, fields);
    },

    search: function(q, handler) {
      this.db.ylsearch.where('fulltext', q, 'like');
      $.each(this.db.ylsearch.select(), handler);
    },

    enableSearchBox: function() {
      $('.ylsearch-lsbox input.search').attr('placeholder',
                                           this.i18n['JS_TypeToSearch']);
      $('.ylsearch-lsbox *').each(function(index, elem) {
        $(elem).removeAttr('disabled');
      });
    },

    prepareSearchItems: function(handler) {
      $('[ylsearch_id]').each(function(index, element) {
        handler($(element));
      });
    },

    keyUpDelay: (function() {
      var timer = 0;
      return function(callback, ms){
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
      };
    })(),

    bindSearchBox: function(sfunc) {
      var self = this;
      $('.ylsearch-lsbox button.btn').click(sfunc);
      $('.ylsearch-lsbox input.search').keypress(function(e) {
        if (e.which === 13) { sfunc(); }
      });
      $('.ylsearch-lsbox input.search').keyup(function() {
        self.keyUpDelay(function() { sfunc(); }, 200);
      });
    },

    initDefaultSearchBox: function(owner, div, fields) {
      this.init(div, fields);
      this.enableSearchBox();
      this.bindSearchBox(owner.localSearchFunc);
    },
  };

  return LocalSearchHelper;
}();

