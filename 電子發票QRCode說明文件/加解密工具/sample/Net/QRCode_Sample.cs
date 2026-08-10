using System;
using System.Collections.Generic;
using System.Text;

namespace QREncrypter
{
    class Sample
    {
        static void Main(string[] args)
        {
            com.tradevan.qrutil.QREncrypter qrEncrypter = new com.tradevan.qrutil.QREncrypter();
            try
            {

               String [][] abc=new String[1][];

              String result = qrEncrypter.QRCodeINV("AA12345678", "1001231", "150000", "1234", 100, 100, 100, "12345678", "87654321", "12344321", "43211234", "05D4A324ABAF4A570E64E572221E438B");


            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }
            Console.ReadLine();
        }
    }
}
