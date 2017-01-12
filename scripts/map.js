$(window).on('load', function() {
  var documentSettings = {};

  function mapPoints(points) {
    var latlngs = [];

    for (i in points) {
      p = points[i];
      latlngs.push(new Array(
        parseFloat(p['Latitude']),
        parseFloat(p['Longitude']),
        parseFloat(p['Intensity'])
      ));
    }

    var heat = L.heatLayer(latlngs, {
      minOpacity: parseFloat(trySetting('_minOpacity', 0.5)),
      maxZoom: parseInt(trySetting('_maxZoom', 10)),
      max: parseFloat(trySetting('_maxPointIntensity', 1)),
      radius: parseInt(trySetting('_pointRadius', 10)),
      blur: parseInt(trySetting('_blur', 15)),
      gradient: eval('(' + getSetting('_gradient') + ')')
    }).addTo(map);


    var mapCenter = L.latLng();
    var mapZoom = 10;

    // center and zoom map based on points or to user-specified zoom and center
    if (getSetting('_initLat') !== '' && getSetting('_initLon') !== '') {
      mapCenter = L.latLng(getSetting('_initLat'), getSetting('_initLon'));
      map.setView(mapCenter);
    } else {
      /*
      var groupBounds = points.getBounds();
      mapZoom = map.getBoundsZoom(groupBounds);
      mapCenter = groupBounds.getCenter(); */
    }

    if (getSetting('_initZoom') !== '') {
      mapZoom = parseInt(getSetting('_initZoom'));
    }

    //map.setView(mapCenter, mapZoom);
  }

  /**
   * Here all data processing from the spreadsheet happens
   */
  function onMapDataLoad() {
    var options = mapData.sheets(constants.optionsSheetName).elements;
    createDocumentSettings(options);

    document.title = getSetting('_mapTitle');
    addBaseMap();

    // Add point markers to the map
    var points = mapData.sheets(constants.pointsSheetName).elements;
    mapPoints(points);

    // Add Mapzen search control
    if (getSetting('_mapSearch') !== 'off') {
      L.control.geocoder(getSetting('_mapSearchKey'), {
        focus: true,
        position: getSetting('_mapSearch'),
        zoom: trySetting('_mapSearchZoom', 12),
        circle: true,
        circleRadius: trySetting('_mapSearchCircleRadius', 1),
        autocomplete: true,
      }).addTo(map);
    }

    // Add location control
    if (getSetting('_mapMyLocation') !== 'off') {
      var locationControl = L.control.locate({
        keepCurrentZoomLevel: true,
        returnToPrevBounds: true,
        position: getSetting('_mapMyLocation')
      }).addTo(map);
    }

    // Add zoom control
    if (getSetting('_mapZoom') !== 'off') {
      L.control.zoom({position: getSetting('_mapZoom')}).addTo(map);
    }

    addTitle();

    // Change Map attribution to include author's info + urls
    changeAttribution();

    // All processing has been done, so hide the loader and make the map visible
    $('#map').css('visibility', 'visible');
    $('.loader').hide();

    // Open intro popup window in the center of the map
    if (getSetting('_introPopupText') != '') {
      initIntroPopup(getSetting('_introPopupText'), map.getCenter());
    };
  }

  /**
   * Adds title and subtitle from the spreadsheet to the map
   */
  function addTitle() {
    var dispTitle = getSetting('_mapTitleDisplay');

    if (dispTitle !== 'off') {
      var title = '<h3 class="pointer">' + getSetting('_mapTitle') + '</h3>';
      var subtitle = '<h5>' + getSetting('_mapSubtitle') + '</h5>';

      if (dispTitle === 'on') {
        $('div.leaflet-top').prepend('<div class="map-title leaflet-bar leaflet-control leaflet-control-custom">' + title + subtitle + '</div>');
      } else if (dispTitle == 'in points legend') {
        $('#points-legend').prepend(title + subtitle);
      } else if (dispTitle == 'in polygons legend') {
        $('.polygons-legend').prepend(title + subtitle);
      }

      $('.map-title h3').click(function() { location.reload(); });
    }
  }


  function initIntroPopup(info, coordinates) {
    // This is a pop-up for mobile device
    if (window.matchMedia("only screen and (max-width: 760px)").matches) {
      $('body').append('<div id="mobile-intro-popup"><p>' + info +
        '</p><div id="mobile-intro-popup-close"><i class="fa fa-times"></i></div></div>');

      $('#mobile-intro-popup-close').click(function() {
        $("#mobile-intro-popup").hide();
      });
      return;
    }

    /* And this is a standard popup for bigger screens */
    L.popup({className: 'intro-popup'})
      .setLatLng(coordinates) // this needs to change
      .setContent(info)
      .openOn(map);
  }

  /**
   * Changes map attribution (author, GitHub repo, email etc.) in bottom-right
   */
  function changeAttribution() {
    var attributionHTML = $('.leaflet-control-attribution')[0].innerHTML;
    var credit = 'View <a href="' + googleDocURL + '" target="_blank">data</a>';
    var name = getSetting('_authorName');
    var url = getSetting('_authorURL');

    if (name && url) {
      if (url.indexOf('@') > 0) { url = 'mailto:' + url; }
      credit += ' by <a href="' + url + '">' + name + '</a> | ';
    } else if (name) {
      credit += ' by ' + name + ' | ';
    } else {
      credit += ' | ';
    }

    credit += 'View <a href="' + getSetting('_githubRepo') + '">code</a>';
    if (getSetting('_codeCredit')) credit += ' by ' + getSetting('_codeCredit');
    credit += ' with ';
    $('.leaflet-control-attribution')[0].innerHTML = credit + attributionHTML;
  }


  /**
   * Loads the basemap and adds it to the map
   */
  function addBaseMap() {
    var basemap = trySetting('_tileProvider', 'Stamen.TonerLite');
    L.tileLayer.provider(basemap, {
      maxZoom: 18
    }).addTo(map);
    L.control.attribution({
      position: trySetting('_mapAttribution', 'bottomright')
    }).addTo(map);
  }

  /**
   * Returns the value of a setting s
   * getSetting(s) is equivalent to documentSettings[constants.s]
   */
  function getSetting(s) {
    return documentSettings[constants[s]];
  }

  /**
   * Returns the value of setting named s from constants.js
   * or def if setting is either not set or does not exist
   * Both arguments are strings
   * e.g. trySetting('_authorName', 'No Author')
   */
  function trySetting(s, def) {
    s = getSetting(s);
    if (!s || s.trim() === '') { return def; }
    return s;
  }

  /**
   * Triggers the load of the spreadsheet and map creation
   */
   var mapData;

   $.ajax({
       url:'csv/Options.csv',
       type:'HEAD',
       error: function() {
         // Options.csv does not exist, so use Tabletop to fetch data from
         // the Google sheet
         mapData = Tabletop.init({
           key: googleDocURL,
           callback: function(data, mapData) { onMapDataLoad(); }
         });
       },
       success: function() {
         // Get all data from .csv files
         mapData = Procsv;
         mapData.load({
           self: mapData,
           tabs: ['Options', 'Points', 'Polygons', 'Polylines'],
           callback: onMapDataLoad
         });
       }
   });

  /**
   * Reformulates documentSettings as a dictionary, e.g.
   * {"webpageTitle": "Leaflet Boilerplate", "infoPopupText": "Stuff"}
   */
  function createDocumentSettings(settings) {
    for (var i in settings) {
      var setting = settings[i];
      documentSettings[setting.Setting] = setting.Customize;
    }
  }

});
