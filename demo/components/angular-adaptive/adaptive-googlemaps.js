/**
 * angular-adaptive-googlemaps v0.1.2
 * The MIT License
 * Copyright (c) 2013 Jan Antala
 */

(function (google) {
  'use strict';

  var adaptive = angular.module('adaptive.googlemaps', []);

  adaptive.controller('GoogleMapsCtrl', [ '$scope', '$element', '$parse', '$log', function ($scope, $element, $parse, $log) {

    var STATIC_URL = '//maps.googleapis.com/maps/api/staticmap?';
    var mapLoaded = false;
    var that = this;

    /**
     * Private methods
     */

    var getLocation = function(center, success, error) {
      var geocoder = new google.maps.Geocoder();
      geocoder.geocode( { 'address': center}, function(results, status) {
        if (status === google.maps.GeocoderStatus.OK) {
          success(results[0].geometry.location);
        }
        else {
          error('Geocode was not successful for the following reason: ' + status);
        }
      });
    };

    var addMarker = function(address, map) {
      getLocation(address, function(location){
        var marker = new google.maps.Marker({
          position: location,
          title: address,
          map: map,
          draggable: false,
          animation: google.maps.Animation.DROP
        });
      });
    };

    var getMapType = function(maptype, href) {
      switch (maptype) {
        case 'satellite':
          return href ? 'k' : google.maps.MapTypeId.SATELLITE;
        case 'terrain':
          return href ? 'p' : google.maps.MapTypeId.TERRAIN;
        case 'hybrid':
          return href ? 'h' : google.maps.MapTypeId.HYBRID;
        default: // 'roadmap'
          return href ? 'm' : google.maps.MapTypeId.ROADMAP;
      }
    };

    /**
     * Public methods
     */

    this.buildStaticMap = function buildStaticMap(MAP_EVENTS, staticAttributes) {
      var markerStrings;
      var markers = staticAttributes.markers;

      if (markers) {
        if (!angular.isArray(markers)) {
          markers = [markers];
        }
        markerStrings = markers;
      }

      var attrs = staticAttributes;
      var params = Object.keys(attrs).map(function (attr) {
        if (attr === 'markers' && markerStrings) {
          return Object.keys(markerStrings).map(function (key) {
            return 'markers=' + encodeURIComponent(markerStrings[key]);
          }).join('&');
        }

        return encodeURIComponent(attr) + '=' + encodeURIComponent(attrs[attr]);
      });

      (function(MAP_EVENTS){
        var query = markers && markers.length ? markers[0] : '';
        if (MAP_EVENTS.redirect && !$scope.location) {
          getLocation(
            $scope.options.center,
            function(location){
              $scope.location = location;
              $scope.MAP_HREF = 'http://maps.apple.com/?ll=' + location.mb + ',' + location.nb + '&q=' + query + '&z=' + $scope.zoom + '&t=' + getMapType($scope.maptype, true);
              $scope.$apply();
            },
            function(error){
              $scope.MAP_HREF = 'http://maps.apple.com/?' + '&q=' + query + '&z=' + $scope.zoom + '&t=' + getMapType($scope.maptype, true);
              $scope.$apply();
            }
          );
        }
      })(MAP_EVENTS);

      $scope.imgsrc = STATIC_URL + params.reduce(function (a, b) {
        if (!a) {
          return b;
        }

        if (b !== undefined) {
          return a + '&' + b;
        }

        return a;
      }, '');

      $scope.updateStyle();
    };

    this.buildDynamicMap = function(MAP_EVENTS, $element, dynamicAttributes) {
      var mapOptions = {
        center: ($scope.location || new google.maps.LatLng(0, 0)),
        zoom: (Number(dynamicAttributes.zoom) || 6),
        mapTypeId: getMapType(dynamicAttributes.maptype, false)
      };

      var map = new google.maps.Map($element[0], mapOptions);

      getLocation(
        dynamicAttributes.center,
        function(location){
          map.setCenter(location);
          for (var i = 0; dynamicAttributes.markers && i < dynamicAttributes.markers.length; i++) {
            addMarker(dynamicAttributes.markers[i], map);
          }
        },
        function(error){
          $log.error(error);
        }
      );
    };

    $scope.updateStyle = function(){
      $scope.style = {
        'display': 'block',
        'cursor': 'pointer',
        'background-image': 'url(\'' + ($scope.imgsrc || STATIC_URL + 'sensor=' + ($scope.options.sensor || false) + '&size=' + ($scope.options.size)) + '\')',
        'background-repeat': 'no-repeat',
        '-webkit-background-size': 'cover',
        '-moz-background-size': 'cover',
        '-o-background-size': 'cover',
        '-ms-background-size': 'cover',
        'background-size': 'cover',
        'background-position': 'center center'
      };
    };

    $scope.updateStyle();

  }]);

  adaptive.directive('googlemaps', [ '$parse', function ($parse) {
    return {
      template: '<a ng-style="style" ng-href="{{MAP_HREF}}" target="_blank"></a>',
      replace: true,
      restrict: 'E',
      controller: 'GoogleMapsCtrl',
      scope: {
        options: '='
      },

      link: function postLink(scope, element, attrs, ctrl) {

        var ael = element;
        var MAP_EVENTS = angular.extend({}, scope.options.mapevents);

        console.log(scope.options);

        if (scope.options.sensor === undefined) {
          throw new Error('The `sensor` attribute is required.');
        }

        if (!scope.options.size) {
          throw new Error('The `size` attribute is required.');
        }

        if (!scope.options.center) {
          throw new Error('The `center` attribute is required.');
        }

        var sizeBits = scope.options.size.split('x');
        if (sizeBits.length !== 2) {
          throw new Error('Size must be specified as `wxh`.');
        }

        var staticAttributes = {
          'sensor': scope.options.sensor,
          'size': scope.options.size,
          'maptype': scope.options.maptype,
          'center': scope.options.center,
          'zoom': scope.options.zoom,
          'markers': scope.options.markers
        };

        var dynamicAttributes = {
          'maptype': scope.options.maptype,
          'center': scope.options.center,
          'zoom': scope.options.zoom,
          'markers': scope.options.markers
        };
        
        ctrl.buildStaticMap(MAP_EVENTS, staticAttributes);

        var mapLoaded = false;
        element.bind('click', function(event){
          if (MAP_EVENTS.loadmap && !mapLoaded) {
            event.preventDefault();
            mapLoaded = true;
            ael.removeAttr('href');
            ctrl.buildDynamicMap(MAP_EVENTS, ael, dynamicAttributes);
          }
          else if (!MAP_EVENTS.redirect && !mapLoaded) {
            event.preventDefault();
          }
          else if (!MAP_EVENTS.loadmap && mapLoaded) {
            event.preventDefault();
          }
        });
      }
    };
  }]);
}(google));