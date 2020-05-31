/* API Includes */
var svc = require('dw/svc');

/* Utility */
var util = require('~/cartridge/scripts/helpers/ckoHelper');

var networkToken = {  
    /**
     * Initialize HTTP service for the Checkout.com sandbox network token.
     */
    sandbox: function() {
        return svc.LocalServiceRegistry.createService("cko.network.token.sandbox.service", {
            createRequest: function (svc, args) {
                // Prepare the http service
                svc.addHeader("Authorization", util.getAccountKeys().publicKey);
                svc.addHeader("User-Agent", util.getCartridgeMeta());
                svc.addHeader("Content-Type", 'application/json;charset=UTF-8');

                return (args) ? args : null;
            },

            parseResponse: function (svc, resp) {
                return JSON.parse(resp.text);
            }
        });
    },

    /**
     * Initialize HTTP service for the Checkout.com live network token.
     */
    live: function() {
        return svc.LocalServiceRegistry.createService("cko.network.token.live.service", {
            createRequest: function (svc, args) {
                // Prepare the http service
                svc.addHeader("Authorization", util.getAccountKeys().publicKey);
                svc.addHeader("User-Agent", util.getCartridgeMeta());
                svc.addHeader("Content-Type", 'application/json;charset=UTF-8');
            
                return (args) ? args : null;
            },

            parseResponse: function (svc, resp) {
                return JSON.parse(resp.text);
            }
        });
    }
};

/*
* Module exports
*/
module.exports = networkToken;