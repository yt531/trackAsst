using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace SampleProject
{
    class Sample
    {
        static void Main(string[] args)
        {
            com.tradevan.qrutil.QREncrypter qrEncrypter = new com.tradevan.qrutil.QREncrypter();
            try
            {
              String result = qrEncrypter.AESEncrypt("Test", "78D92C1FA999954120227B664B29FF93");
             
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }
            Console.ReadLine();
        }
    }
}
