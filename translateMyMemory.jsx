// ============================================================
// AUTO TRANSLATOR — MyMemory | ScriptUI Panel
// Install: Scripts/ScriptUI Panels/ → restart AE
// ============================================================

(function (thisObj) {
  var LANGS = [
    { code: 'es', id: 'ES', name: 'Іспанська', color: 12 }, // Brown
    { code: 'pt', id: 'PT', name: 'Португальська', color: 9 }, // Green
    { code: 'it', id: 'IT', name: 'Італійська', color: 3 }, // Aqua
    { code: 'de', id: 'DE', name: 'Німецька', color: 2 }, // Yellow
    { code: 'fr', id: 'FR', name: 'Французька', color: 8 }, // Blue
    { code: 'pl', id: 'PL', name: 'Польська', color: 4 }, // Pink
    { code: 'tr', id: 'TR', name: 'Турецька', color: 11 }, // Orange
    { code: 'uk', id: 'UA', name: 'Українська', color: 5 }, // Lavender
  ];

  // ── Decode JSON escape sequences ──────────────────────────
  function decodeJSON(str) {
    return str
      .replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) {
        return String.fromCharCode(parseInt(h, 16));
      })
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
      .replace(/\\r\\n/g, '\r')
      .replace(/\\r/g, '\r')
      .replace(/\\n/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  // ── HTTP GET via curl ─────────────────────────────────────
  function httpGet(host, path) {
    var url = 'https://' + host + path;
    var body = system.callSystem('curl -s --max-time 20 "' + url + '"');
    if (!body || body.length === 0) {
      throw new Error('Немає відповіді від ' + host);
    }
    return body;
  }

  // ── Text chunking (MyMemory limit: 500 bytes per request) ─
  var CHUNK_LIMIT = 500;

  function chunkText(text) {
    if (text.length <= CHUNK_LIMIT) return [text];
    var chunks = [];
    var remaining = text;
    while (remaining.length > CHUNK_LIMIT) {
      // lastIndexOf with fromIndex searches backward — always cuts at a space
      var cut = remaining.lastIndexOf(' ', CHUNK_LIMIT);
      if (cut <= 0) cut = CHUNK_LIMIT; // no space found — hard cut
      chunks.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut + 1);
    }
    if (remaining.length) chunks.push(remaining);
    return chunks;
  }

  function hasHardCut(text) {
    var remaining = text;
    while (remaining.length > CHUNK_LIMIT) {
      var cut = remaining.lastIndexOf(' ', CHUNK_LIMIT);
      if (cut <= 0) return true;
      remaining = remaining.slice(cut + 1);
    }
    return false;
  }

  function translateText(text, langCode) {
    var chunks = chunkText(text);
    if (chunks.length === 1) return callTranslate(text, langCode);
    var parts = [];
    for (var i = 0; i < chunks.length; i++) {
      parts.push(callTranslate(chunks[i], langCode));
    }
    return parts.join(' ');
  }

  // ── MyMemory API ──────────────────────────────────────────
  function callTranslate(text, langCode) {
    if (!text || !text.replace(/\s/g, '')) return text;

    var encoded = encodeURIComponent(text);
    var target = langCode.split('-')[0];
    var email = app.settings.haveSetting('Translator', 'email')
      ? app.settings.getSetting('Translator', 'email')
      : '';
    var path =
      '/get?q=' +
      encoded +
      '&langpair=en|' +
      target +
      (email ? '&de=' + encodeURIComponent(email) : '');

    var body = httpGet('api.mymemory.translated.net', path);

    // some curl versions write errors to stdout instead of stderr
    if (/^curl:\s*\(\d+\)/.test(body)) {
      throw new Error(
        'Мережева помилка: ' + body.replace(/\n/g, ' ').slice(0, 80),
      );
    }

    var statusM = body.match(/"responseStatus"\s*:\s*(\d+)/);
    var status = statusM ? parseInt(statusM[1], 10) : 200;

    var quotaM = body.match(/"quotaFinished"\s*:\s*(true|false)/);
    var quotaFinished = quotaM && quotaM[1] === 'true';

    if (status === 429 || quotaFinished) {
      var detM = body.match(/"responseDetails"\s*:\s*"([^"]+)"/);
      var details = detM ? decodeJSON(detM[1]) : '';
      var hoursM = details.match(/NEXT AVAILABLE IN\s+(\d+)/i);
      var msg = 'Ліміт MyMemory вичерпано.';
      if (hoursM) msg += ' Скидання через ~' + hoursM[1] + ' год.';
      else if (details) msg += ' ' + details.slice(0, 60);
      throw new Error(msg);
    }

    if (status !== 200) {
      throw new Error('MyMemory: HTTP ' + status);
    }

    var m = body.match(/"translatedText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!m || !m[1]) {
      throw new Error('Не вдалось розпарсити відповідь: ' + body.slice(0, 80));
    }

    var result = decodeJSON(m[1]);

    // MYMEMORY WARNING can also appear inside translatedText (older API versions)
    if (result.indexOf('MYMEMORY WARNING') !== -1) {
      var hoursM2 = result.match(/NEXT AVAILABLE IN\s+(\d+)/i);
      var msg2 = 'Ліміт MyMemory вичерпано.';
      if (hoursM2) msg2 += ' Скидання через ~' + hoursM2[1] + ' год.';
      throw new Error(msg2);
    }

    $.sleep(300);
    return result;
  }

  // ── Existing translation detection ───────────────────────
  function getExistingLangCodes(comp) {
    var found = {};
    for (var l = 1; l <= comp.layers.length; l++) {
      var layer = comp.layers[l];
      if (layer.comment && layer.comment.indexOf('TRANSLATED:') === 0) {
        found[layer.comment.slice('TRANSLATED:'.length)] = true;
      }
    }
    return found;
  }

  function showConflictDialog(langIds) {
    var dlg = new Window('dialog', 'Переклади вже існують');
    dlg.orientation = 'column';
    dlg.alignChildren = ['fill', 'top'];
    dlg.margins = 16;
    dlg.spacing = 10;

    dlg.add(
      'statictext',
      undefined,
      'Знайдено існуючі переклади: ' + langIds.join(', '),
    );
    dlg.add(
      'statictext',
      undefined,
      'Що робити з ними?\n"Перекласти заново" видалить існуючі шари.',
      { multiline: true },
    );

    var g = dlg.add('group');
    g.alignment = ['center', 'top'];
    g.spacing = 8;
    var btnSkip = g.add('button', undefined, 'Пропустити існуючі');
    var btnOverwrite = g.add('button', undefined, 'Перекласти заново');

    var skip = true;
    btnSkip.onClick = function () {
      skip = true;
      dlg.close();
    };
    btnOverwrite.onClick = function () {
      skip = false;
      dlg.close();
    };

    dlg.center();
    dlg.show();
    return skip;
  }

  // ── Email dialog ──────────────────────────────────────────
  function showEmailDialog() {
    var dlg = new Window('dialog', 'Email для перекладу');
    dlg.orientation = 'column';
    dlg.alignChildren = ['fill', 'top'];
    dlg.margins = 16;
    dlg.spacing = 10;

    var info = dlg.add(
      'statictext',
      undefined,
      'Реєстрація не потрібна.\n' +
        'Вкажіть будь-який свій email —\n' +
        'це збільшить ліміт з 5 000 до\n' +
        '50 000 символів на день.',
      { multiline: true },
    );
    info.alignment = ['fill', 'top'];

    var field = dlg.add(
      'edittext',
      undefined,
      app.settings.haveSetting('Translator', 'email')
        ? app.settings.getSetting('Translator', 'email')
        : '',
    );
    field.preferredSize = [260, 22];

    var g = dlg.add('group');
    g.alignment = ['center', 'top'];
    var btnSave = g.add('button', undefined, 'Зберегти');
    var btnSkip = g.add('button', undefined, 'Пропустити');

    var saved = '';
    btnSave.onClick = function () {
      var v = field.text.replace(/^\s+|\s+$/g, '');
      if (v) {
        app.settings.saveSetting('Translator', 'email', v);
        saved = v;
      }
      dlg.close();
    };
    btnSkip.onClick = function () {
      dlg.close();
    };

    dlg.center();
    dlg.show();
    return saved;
  }

  // ── UI ────────────────────────────────────────────────────
  function buildUI(thisObj) {
    var win =
      thisObj instanceof Panel
        ? thisObj
        : new Window('palette', 'Translator v1.0', undefined, {
            resizeable: true,
          });

    if (!app.settings.haveSetting('Translator', 'email')) {
      showEmailDialog();
    }

    win.orientation = 'row';
    win.alignChildren = ['fill', 'fill'];
    win.spacing = 0;
    win.margins = 0;

    var content = win.add('group');
    content.orientation = 'column';
    content.alignChildren = ['fill', 'top'];
    content.spacing = 4;
    content.margins = 6;
    content.alignment = ['fill', 'fill'];

    var vScroll = win.add('scrollbar', undefined, 0, 0, 100);
    vScroll.preferredSize.width = 14;
    vScroll.stepdelta = 20;
    vScroll.jumpdelta = 60;
    vScroll.alignment = ['right', 'fill'];
    vScroll.visible = false;

    var pLang = content.add('panel', undefined, 'Мови');
    pLang.orientation = 'column';
    pLang.alignChildren = ['fill', 'top'];
    pLang.margins = [6, 14, 6, 6];
    pLang.spacing = 2;

    var gSel = pLang.add('group');
    gSel.orientation = 'row';
    gSel.margins = 0;
    gSel.spacing = 4;
    var bAll = gSel.add('button', undefined, 'Всі');
    bAll.preferredSize = [50, 18];
    var bNone = gSel.add('button', undefined, 'Жодного');
    bNone.preferredSize = [65, 18];

    var checks = [];
    var gLangRow;
    for (var i = 0; i < LANGS.length; i++) {
      if (i % 2 === 0) {
        gLangRow = pLang.add('group');
        gLangRow.orientation = 'row';
        gLangRow.alignChildren = ['fill', 'top'];
        gLangRow.spacing = 2;
        gLangRow.margins = 0;
      }
      var chk = gLangRow.add(
        'checkbox',
        undefined,
        LANGS[i].id + ' ' + LANGS[i].name,
      );
      chk.alignment = ['left', 'top'];
      chk.preferredSize.width = 130;
      chk.value = i < 7;
      checks.push(chk);
    }

    bAll.onClick = function () {
      for (var i = 0; i < checks.length; i++) checks[i].value = true;
    };
    bNone.onClick = function () {
      for (var i = 0; i < checks.length; i++) checks[i].value = false;
    };

    var pEmail = content.add('panel', undefined, 'API Email');
    pEmail.orientation = 'row';
    pEmail.alignChildren = ['fill', 'center'];
    pEmail.margins = [6, 14, 6, 6];
    pEmail.spacing = 4;

    var emailLabel = pEmail.add(
      'statictext',
      undefined,
      app.settings.haveSetting('Translator', 'email')
        ? app.settings.getSetting('Translator', 'email')
        : 'не вказано',
    );
    emailLabel.alignment = ['fill', 'center'];

    var btnEmail = pEmail.add('button', undefined, 'Змінити');
    btnEmail.preferredSize = [60, 18];
    btnEmail.onClick = function () {
      var result = showEmailDialog();
      if (result) emailLabel.text = result;
    };

    var statusText = content.add('statictext', undefined, '', {
      multiline: true,
    });
    statusText.alignment = ['fill', 'top'];
    statusText.preferredSize.height = 32;

    var btnGo = content.add('button', undefined, '▶  Перекласти');
    btnGo.alignment = ['fill', 'top'];
    btnGo.preferredSize.height = 46;

    function setStatus(msg) {
      statusText.text = msg;
      $.sleep(1);
    }

    function showError(lines) {
      var dlg = new Window('palette', 'Помилки перекладу');
      dlg.orientation = 'column';
      dlg.alignChildren = ['fill', 'top'];
      dlg.margins = 14;
      dlg.spacing = 10;
      var txt = dlg.add('edittext', undefined, lines.join('\n'), {
        multiline: true,
        readonly: true,
        scrolling: true,
      });
      txt.preferredSize = [300, 140];
      var btn = dlg.add('button', undefined, 'OK');
      btn.alignment = ['center', 'top'];
      btn.onClick = function () {
        dlg.close();
      };
      dlg.center();
      dlg.show();
    }

    function getSelectedLangs() {
      var out = [];
      for (var i = 0; i < checks.length; i++)
        if (checks[i].value) out.push(LANGS[i]);
      return out;
    }

    function getSourceLayers(comp) {
      var out = [];
      for (var l = 1; l <= comp.layers.length; l++) {
        var layer = comp.layers[l];
        if (!(layer instanceof TextLayer)) continue;
        if (layer.comment && layer.comment.indexOf('TRANSLATED:') === 0)
          continue;
        if (!layer.selected) continue;
        out.push(layer);
      }
      return out;
    }

    function makeLayer(src, text, langId, langCode, color) {
      var dup = src.duplicate();
      var label = text.length > 50 ? text.slice(0, 47) + '...' : text;
      dup.name = '[' + langId + '] ' + label;
      dup.enabled = false;
      dup.label = color;
      dup.comment = 'TRANSLATED:' + langCode;
      dup.moveBefore(src);
      var prop = dup.property('Source Text');
      var doc = prop.value;
      doc.text = text;
      prop.setValue(doc);
    }

    btnGo.onClick = function () {
      try {
        run();
      } catch (e) {
        setStatus('❌ Критична помилка');
        showError(['Критична помилка:', e.message || String(e)]);
      }
    };

    function run() {
      var comp = app.project.activeItem;
      if (!comp || !(comp instanceof CompItem)) {
        setStatus('❌ Немає активної компо');
        showError(['Немає активної компо!']);
        return;
      }

      var srcLayers = getSourceLayers(comp);
      if (!srcLayers.length) {
        setStatus('⚠ Виділи текстові шари');
        showError(['Виділи текстові шари!']);
        return;
      }

      var selLangs = getSelectedLangs();
      if (!selLangs.length) {
        setStatus('⚠ Вибери хоча б одну мову');
        showError(['Вибери хоча б одну мову!']);
        return;
      }

      for (var vi = 0; vi < srcLayers.length; vi++) {
        var vtext = srcLayers[vi].property('Source Text').value.text;
        if (hasHardCut(vtext)) {
          setStatus('❌ Текст містить рядок > 500 символів без пробілу');
          showError([
            'Шар "' + srcLayers[vi].name + '"',
            'містить рядок довший за 500 символів без пробілів.',
            'Скоротіть текст і спробуйте знову.',
          ]);
          return;
        }
      }

      var existingCodes = getExistingLangCodes(comp);
      var conflicts = [];
      for (var ci = 0; ci < selLangs.length; ci++) {
        if (existingCodes[selLangs[ci].code]) conflicts.push(selLangs[ci]);
      }

      if (conflicts.length) {
        var conflictIds = [];
        for (var ci = 0; ci < conflicts.length; ci++)
          conflictIds.push(conflicts[ci].id);
        var skipExisting = showConflictDialog(conflictIds);
        if (skipExisting) {
          var filtered = [];
          for (var ci = 0; ci < selLangs.length; ci++) {
            if (!existingCodes[selLangs[ci].code]) filtered.push(selLangs[ci]);
          }
          selLangs = filtered;
          if (!selLangs.length) {
            setStatus('Всі вибрані переклади вже існують');
            return;
          }
        } else {
          for (var l = comp.layers.length; l >= 1; l--) {
            var layer = comp.layers[l];
            if (!layer.comment || layer.comment.indexOf('TRANSLATED:') !== 0)
              continue;
            var layerCode = layer.comment.slice('TRANSLATED:'.length);
            if (existingCodes[layerCode]) layer.remove();
          }
        }
      }

      setStatus('⏳ Перекладаю...');

      app.beginUndoGroup('Multi Translate');
      var ok = 0,
        errors = [];

      for (var li = 0; li < srcLayers.length; li++) {
        var src = srcLayers[li];
        var orig = src.property('Source Text').value.text;
        if (!orig || !orig.replace(/\s/g, '')) continue;

        src.enabled = false;

        for (var gi = 0; gi < selLangs.length; gi++) {
          var lang = selLangs[gi];
          setStatus(
            '⏳ Шар ' +
              (li + 1) +
              '/' +
              srcLayers.length +
              ' | ' +
              lang.id +
              ' ' +
              (gi + 1) +
              '/' +
              selLangs.length,
          );
          try {
            var t = translateText(orig, lang.code);
            makeLayer(src, t, lang.id, lang.code, lang.color);
            ok++;
          } catch (e) {
            errors.push('[' + lang.id + '] ' + src.name + ': ' + e.message);
          }
        }
      }

      app.endUndoGroup();

      if (errors.length > 0) {
        setStatus('⚠ Готово з помилками: ' + ok + '✓  ' + errors.length + '✕');
        errors.unshift('Перекладено: ' + ok + '  |  Помилок: ' + errors.length);
        errors.unshift('');
        showError(errors);
      } else {
        setStatus(
          '✓ Перекладено ' +
            ok +
            (ok % 10 === 1 && ok !== 11
              ? ' варіант'
              : ok % 10 >= 2 && ok % 10 <= 4 && (ok < 10 || ok > 20)
                ? ' варіанти'
                : ' варіантів'),
        );
      }
    }

    // ── Layout & scroll ───────────────────────────────────────
    var baseY = 0;

    function syncScroll() {
      var overflow = content.size[1] - win.size[1];
      if (overflow > 0) {
        vScroll.visible = true;
        vScroll.maxvalue = overflow;
        content.location.y = baseY - Math.round(vScroll.value);
      } else {
        vScroll.visible = false;
        vScroll.value = 0;
        content.location.y = baseY;
      }
    }

    vScroll.onChange = vScroll.onChanging = function () {
      content.location.y = baseY - Math.round(this.value);
    };

    win.addEventListener('mousewheel', function (e) {
      if (!vScroll.visible) return;
      vScroll.value = Math.max(
        0,
        Math.min(vScroll.maxvalue, vScroll.value + e.detail * 20),
      );
      content.location.y = baseY - Math.round(vScroll.value);
    });

    win.onResizing = win.onResize = function () {
      this.layout.resize();
      syncScroll();
    };

    if (win instanceof Window) {
      win.preferredSize = [200, 520];
      win.center();
      win.layout.layout(true);
      baseY = content.location.y;
      syncScroll();
      win.show();
    } else {
      win.layout.layout(true);
      baseY = content.location.y;
      syncScroll();
    }

    return win;
  }

  buildUI(thisObj);
})(this);
