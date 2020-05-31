/* API Includes */
var svc = require('dw/svc');

/* Utility */
var util = require('~/cartridge/scripts/helpers/ckoHelper');

var klarnaSession = {  
    /**
     * Initialize HTTP service for the Checkout.com sandbox full card charge.
     */
    sandbox: function() {
        return svc.LocalServiceRegistry.createService("cko.klarna.session.sandbox.service", {
            createRequest: function (svc, args) {
                // Prepare the http service
                svc.addHeader("Authorization", util.getAccountKeys().secretKey);
                svc.addHeader("User-Agent", util.getCartridgeMeta());
                svc.addHeader("Content-Type", 'application/json;charset=UTF-8');
                
                return (args) ? JSON.stringify(args) : null;
            },

            parseResponse: function (svc, resp) {
                return JSON.parse(resp.text);
            }
        });
    },

    /**
     * Initialize HTTP service for the Checkout.com live full card charge.
     */
    live: function() {
        return svc.LocalServiceRegistry.createService("cko.klarna.session.live.service", {
            createRequest: function (svc, args) {
                // Prepare the http service
                svc.addHeader("Authorization", util.getAccountKeys().secretKey);
                svc.addHeader("User-Agent", util.getCartridgeMeta());
                svc.addHeader("Content-Type", 'application/json;charset=UTF-8');
            
                return (args) ? JSON.stringify(args) : null;
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
module.exports = klarnaSession;
